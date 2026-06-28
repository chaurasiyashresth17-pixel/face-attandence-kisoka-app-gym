/**
 * Validates that a face descriptor is a number array of length 128.
 * @param {any} descriptor
 * @returns {boolean}
 */
export function isValidDescriptor(descriptor) {
  if (!Array.isArray(descriptor)) return false;
  if (descriptor.length !== 128) return false;
  return descriptor.every((v) => typeof v === 'number' && isFinite(v));
}

/**
 * Computes Euclidean distance between two 128-dim face descriptors.
 * @param {number[]} d1
 * @param {number[]} d2
 * @returns {number}
 */
export function euclideanDistance(d1, d2) {
  let sum = 0;
  for (let i = 0; i < d1.length; i++) {
    const diff = d1[i] - d2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Finds the best matching member from cached descriptors.
 * @param {Float32Array|number[]} detectedDescriptor
 * @param {{ member: object, descriptor: number[] }[]} cachedDescriptors
 * @param {number} threshold - default 0.5
 * @returns {{ member: object, distance: number } | null}
 */
export function findBestMatch(detectedDescriptor, cachedDescriptors, threshold = 0.5) {
  const detected = Array.from(detectedDescriptor);
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const { member, descriptor } of cachedDescriptors) {
    try {
      if (!isValidDescriptor(descriptor)) continue;
      const distance = euclideanDistance(detected, descriptor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = { member, distance };
      }
    } catch {
      // Skip invalid descriptor
    }
  }

  if (bestMatch && bestDistance <= threshold) {
    return bestMatch;
  }
  return null;
}
