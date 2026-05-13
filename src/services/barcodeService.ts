import type { ScanResult } from '../types';

async function lookupOpenFoodFacts(
  barcode: string,
  signal: AbortSignal
): Promise<ScanResult> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_es,product_name_en,generic_name,brands`,
    { signal }
  );
  if (!res.ok) return { status: 'not_found' };
  const data = await res.json();
  const p = data.product;
  // Try name fields in order of preference (many AR products lack product_name but have _es)
  const name = p?.product_name || p?.product_name_es || p?.product_name_en || p?.generic_name;
  if (data.status === 1 && name) {
    return {
      status: 'found',
      name: (name as string).trim(),
      brand: p.brands as string | undefined,
      source: 'openfoodfacts',
    };
  }
  return { status: 'not_found' };
}

async function lookupUPCItemDB(
  barcode: string,
  signal: AbortSignal
): Promise<ScanResult> {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
    { signal }
  );
  const data = await res.json();
  const item = (data.items as Array<{ title?: string; brand?: string }>)?.[0];
  if (item?.title) {
    return {
      status: 'found',
      name: item.title,
      brand: item.brand,
      source: 'upcitemdb',
    };
  }
  return { status: 'not_found' };
}

// Open Food Facts sister databases: covers non-food products (cosmetics, pet food, etc.)
// Same API shape as OFF — good complement for products missing from world.OFF
async function lookupOpenProductsFacts(
  barcode: string,
  signal: AbortSignal
): Promise<ScanResult> {
  const bases = [
    'https://world.openbeautyfacts.org',
    'https://world.openpetfoodfacts.org',
    'https://world.openproductsfacts.org',
  ];
  let lastError: unknown;
  for (const base of bases) {
    try {
      const res = await fetch(
        `${base}/api/v2/product/${barcode}?fields=product_name,product_name_es,product_name_en,generic_name,brands`,
        { signal }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const p = data.product;
      const name = p?.product_name || p?.product_name_es || p?.product_name_en || p?.generic_name;
      if (data.status === 1 && name) {
        return { status: 'found', name: (name as string).trim(), brand: p.brands as string | undefined, source: 'openfacts' };
      }
      lastError = undefined; // got a valid response, just not found
    } catch (e) {
      if (signal.aborted) throw e; // propagate abort immediately
      lastError = e; // CORS or network — try next base
    }
  }
  // All bases threw hard errors → propagate so raceToSuccess counts as failure
  if (lastError !== undefined) throw lastError;
  return { status: 'not_found' };
}

// Policy: soft failures (no name in response) → not_found; all-hard-reject (fetch throws) → error
function raceToSuccess(
  fetchers: Array<(signal: AbortSignal) => Promise<ScanResult>>,
  controllers: AbortController[]
): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let settled = 0;
    let hardFailures = 0;
    let firstError: Error | null = null;

    fetchers.forEach((fetcher, i) => {
      fetcher(controllers[i].signal)
        .then((result) => {
          settled++;
          if (resolved) return;
          if (result.status === 'found') {
            resolved = true;
            controllers.forEach((c, j) => { if (j !== i) c.abort(); });
            resolve(result);
          } else if (settled === fetchers.length) {
            if (hardFailures === fetchers.length) {
              reject(firstError ?? new Error('All fetchers failed'));
            } else {
              resolve({ status: 'not_found' });
            }
          }
        })
        .catch((e: unknown) => {
          settled++;
          hardFailures++;
          if (!firstError) {
            firstError = e instanceof Error ? e : new Error(String(e));
          }
          if (!resolved && settled === fetchers.length) {
            if (hardFailures === fetchers.length) {
              reject(firstError);
            } else {
              resolve({ status: 'not_found' });
            }
          }
        });
    });
  });
}

export async function lookup(barcode: string): Promise<ScanResult> {
  const controllers = Array.from({ length: 3 }, () => new AbortController());
  try {
    return await raceToSuccess(
      [
        (sig) => lookupOpenFoodFacts(barcode, sig),
        (sig) => lookupUPCItemDB(barcode, sig),
        (sig) => lookupOpenProductsFacts(barcode, sig),
      ],
      controllers
    );
  } catch (e) {
    return { status: 'error', message: String(e) };
  }
}
