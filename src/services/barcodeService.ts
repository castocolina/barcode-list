import type { ScanResult } from '../types';

async function lookupOpenFoodFacts(
  barcode: string,
  signal: AbortSignal
): Promise<ScanResult> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
    { signal }
  );
  const data = await res.json();
  if (data.status === 1 && data.product?.product_name) {
    return {
      status: 'found',
      name: data.product.product_name as string,
      brand: data.product.brands as string | undefined,
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

async function lookupOpenEAN(
  barcode: string,
  signal: AbortSignal
): Promise<ScanResult> {
  const res = await fetch(
    `https://opengtindb.org/?ean=${barcode}&cmd=wsgetfull&lang=en`,
    { signal }
  );
  const text = await res.text();
  const nameMatch = text.match(/name=([^\n|<]+)/i);
  const name = nameMatch?.[1]?.trim();
  if (name) {
    return { status: 'found', name, source: 'openean' };
  }
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
        (sig) => lookupOpenEAN(barcode, sig),
      ],
      controllers
    );
  } catch (e) {
    return { status: 'error', message: String(e) };
  }
}
