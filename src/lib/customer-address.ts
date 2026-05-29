export type CustomerRegionCatalog = {
  province: string;
  regencies: string[];
  districtsByRegency: Record<string, string[]>;
};

export type CustomerRegionScope = "district" | "regency" | "province";

export type ParsedCustomerAddress = {
  street: string;
  district: string;
  regency: string;
  province: string;
};

const UNKNOWN_REGION = "Tidak diketahui";

function normalizeRegion(value: string) {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/KABUPATEN/g, "KAB")
    .replace(/KAB\./g, "KAB")
    .replace(/KOTA ADM\./g, "KOTA")
    .replace(/KECAMATAN/g, "")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchLongestRegion(haystack: string, options: string[]) {
  const normalizedHaystack = normalizeRegion(haystack);
  return [...options]
    .sort((left, right) => right.length - left.length)
    .find((option) => normalizedHaystack.includes(normalizeRegion(option))) ?? "";
}

export function formatCustomerAddress(parts: ParsedCustomerAddress) {
  return [parts.street, parts.district, parts.regency, parts.province]
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((candidate) => normalizeRegion(candidate) === normalizeRegion(part)) === index)
    .join(", ");
}

export function parseCustomerAddress(
  address: string | null | undefined,
  catalog: CustomerRegionCatalog
): ParsedCustomerAddress {
  const rawAddress = address?.trim() ?? "";
  if (!rawAddress) {
    return {
      street: "",
      district: "",
      regency: "",
      province: catalog.province,
    };
  }

  const regency = matchLongestRegion(rawAddress, catalog.regencies);
  const districtOptions = regency
    ? catalog.districtsByRegency[regency] ?? []
    : Object.values(catalog.districtsByRegency).flat();
  const district = matchLongestRegion(rawAddress, districtOptions);
  const province =
    normalizeRegion(rawAddress).includes(normalizeRegion(catalog.province)) || regency || district
      ? catalog.province
      : "";

  const ignored = [district, regency, province]
    .filter(Boolean)
    .map((part) => normalizeRegion(part));

  const street = rawAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const normalized = normalizeRegion(part);
      if (!normalized) return false;
      return !ignored.some(
        (ignoredPart) =>
          normalized === ignoredPart ||
          normalized.includes(ignoredPart) ||
          ignoredPart.includes(normalized)
      );
    })
    .join(", ");

  return {
    street,
    district,
    regency,
    province: province || catalog.province,
  };
}

export function getCustomerRegionLabel(
  address: string | null | undefined,
  scope: CustomerRegionScope,
  catalog: CustomerRegionCatalog
) {
  const parsed = parseCustomerAddress(address, catalog);
  if (scope === "district") return parsed.district || UNKNOWN_REGION;
  if (scope === "province") return parsed.province || UNKNOWN_REGION;
  return parsed.regency || UNKNOWN_REGION;
}
