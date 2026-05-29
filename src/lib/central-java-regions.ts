import { createRequire } from "module";
import type { CustomerRegionCatalog } from "@/lib/customer-address";

const require = createRequire(import.meta.url);

type RegencyRow = {
  kota: string;
  provinsi: string;
};

type DistrictRow = {
  kecamatan: string;
  kota: string;
  provinsi: string;
};

const regencyRows = require("wilayah-indonesia/data/kota.json") as RegencyRow[];
const districtRows = require("wilayah-indonesia/data/kecamatan.json") as DistrictRow[];

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function prettifyRegencyName(value: string) {
  if (value.startsWith("KAB. ")) return `Kabupaten ${toTitleCase(value.slice(5))}`;
  if (value.startsWith("KOTA ")) return `Kota ${toTitleCase(value.slice(5))}`;
  return toTitleCase(value);
}

const CENTRAL_JAVA_PROVINCE = "Jawa Tengah";

const regencies = regencyRows
  .filter((row) => row.provinsi === "JAWA TENGAH")
  .map((row) => prettifyRegencyName(row.kota))
  .sort((left, right) => left.localeCompare(right, "id-ID"));

const districtsByRegency = districtRows
  .filter((row) => row.provinsi === "JAWA TENGAH")
  .reduce<Record<string, string[]>>((acc, row) => {
    const regency = prettifyRegencyName(row.kota);
    const district = toTitleCase(row.kecamatan.replace(/\s+/g, " ").trim());
    if (!acc[regency]) acc[regency] = [];
    if (!acc[regency].includes(district)) acc[regency].push(district);
    return acc;
  }, {});

for (const regency of Object.keys(districtsByRegency)) {
  districtsByRegency[regency].sort((left, right) => left.localeCompare(right, "id-ID"));
}

const CATALOG: CustomerRegionCatalog = {
  province: CENTRAL_JAVA_PROVINCE,
  regencies,
  districtsByRegency,
};

export function getCentralJavaRegionCatalog(): CustomerRegionCatalog {
  return CATALOG;
}
