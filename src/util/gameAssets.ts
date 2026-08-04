import type { AllData as GameData, ApiTranslation } from "./gameData";

export type GameAssetKind = "officer" | "ship" | "research" | "building" | "forbidden_tech" | "consumable";

export type GameAssetRef = {
  kind: GameAssetKind;
  id: number;
  name: string;
  artId: number | null;
  localUrl: string | null;
  remoteUrl: string | null;
};

const OFFICER_ALIASES: Record<string, string> = {
  "pike": "christopher pike",
  "snw pike": "snw christopher pike",
  "snw scotty": "snw montgomery scott",
  "scotty": "montgomery scott",
  "wok scotty": "wok montgomery scott",
  "wok mccoy": "wok leonard mccoy",
  "ent e picard": "enterprise e picard",
  "ent e data": "enterprise e data",
  "ent e troi": "enterprise e troi",
  "tng picard": "jean luc picard",
  "tng data": "data",
  "tos james t kirk": "james t kirk",
  "tos leonard mccoy": "leonard mccoy",
  "tmp uhura": "nyota uhura",
  "tmp hikaru sulu": "hikaru sulu",
  "vger ilia": "v ger ilia",
  "wo k joachim": "wok joachim",
  "wo k saavik": "wok saavik",
  "wo k carol marcus": "wok carol marcus",
};

const SHIP_ALIASES: Record<string, string> = {
  "uss enterprise": "u s s enterprise",
  "uss enterprise e": "u s s enterprise e",
  "uss vengeance": "u s s vengeance",
  "uss relativity": "u s s relativity",
  "gs31": "gs 31",
  "gs 31": "g s 31",
};

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupTranslation(data: ApiTranslation[] | undefined, id: number | undefined, key: string) {
  return data?.find((entry) => entry.id === id && entry.key === key)?.text;
}

function localAssetUrl(kind: GameAssetKind, artId: number | null | undefined) {
  if (!Number.isFinite(Number(artId))) return null;
  const folder =
    kind === "officer" ? "officers" :
    kind === "ship" ? "ships" :
    kind;
  return `/stfc-assets/${folder}/${Number(artId)}.png`;
}

function remoteAssetUrl(kind: GameAssetKind, artId: number | null | undefined) {
  if (!Number.isFinite(Number(artId))) return null;
  const type = kind === "officer" ? "officer" : kind;
  return `https://assets.stfc.space/thumbs/${type}/i/${Number(artId)}.png`;
}

function buildOfficerRefs(data: GameData): GameAssetRef[] {
  return Object.values(data.officer ?? {}).flatMap((officer: any) => {
    const name = lookupTranslation(data.translations?.officer_names, officer.loca_id, "officer_name");
    if (!name) return [];
    const artId = Number.isFinite(Number(officer.art_id)) ? Number(officer.art_id) : null;
    return [{
      kind: "officer" as const,
      id: Number(officer.id),
      name,
      artId,
      localUrl: localAssetUrl("officer", artId),
      remoteUrl: remoteAssetUrl("officer", artId),
    }];
  });
}

function buildShipRefs(data: GameData): GameAssetRef[] {
  return Object.values(data.ship ?? {}).flatMap((ship: any) => {
    const name = lookupTranslation(data.translations?.ships, ship.loca_id, "ship_name");
    if (!name) return [];
    const artId = Number.isFinite(Number(ship.art_id)) ? Number(ship.art_id) : null;
    return [{
      kind: "ship" as const,
      id: Number(ship.id),
      name,
      artId,
      localUrl: localAssetUrl("ship", artId),
      remoteUrl: remoteAssetUrl("ship", artId),
    }];
  });
}

function resolveByName(name: string, refs: GameAssetRef[], aliases: Record<string, string>) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const requested = aliases[normalized] ?? normalized;
  const exact = refs.find((ref) => normalizeName(ref.name) === requested);
  if (exact) return exact;

  const startsWith = refs.find((ref) => normalizeName(ref.name).startsWith(requested));
  if (startsWith) return startsWith;

  if (requested.length >= 4) {
    return refs.find((ref) => normalizeName(ref.name).includes(requested)) ?? null;
  }

  return null;
}

export function resolveOfficerAsset(name: string, data: GameData | undefined): GameAssetRef | null {
  if (!data) return null;
  return resolveByName(name, buildOfficerRefs(data), OFFICER_ALIASES);
}

export function resolveShipAsset(name: string, data: GameData | undefined): GameAssetRef | null {
  if (!data) return null;
  return resolveByName(name, buildShipRefs(data), SHIP_ALIASES);
}

export function officerAssetById(id: number | null | undefined, data: GameData | undefined): GameAssetRef | null {
  if (!data || !Number.isFinite(Number(id))) return null;
  const officer = (data.officer as any)?.[Number(id)];
  if (!officer) return null;
  const name = lookupTranslation(data.translations?.officer_names, officer.loca_id, "officer_name") ?? `Officer ${id}`;
  const artId = Number.isFinite(Number(officer.art_id)) ? Number(officer.art_id) : null;
  return {
    kind: "officer",
    id: Number(id),
    name,
    artId,
    localUrl: localAssetUrl("officer", artId),
    remoteUrl: remoteAssetUrl("officer", artId),
  };
}

export function shipAssetById(id: number | null | undefined, data: GameData | undefined): GameAssetRef | null {
  if (!data || !Number.isFinite(Number(id))) return null;
  const ship = (data.ship as any)?.[Number(id)];
  if (!ship) return null;
  const name = lookupTranslation(data.translations?.ships, ship.loca_id, "ship_name") ?? `Ship ${id}`;
  const artId = Number.isFinite(Number(ship.art_id)) ? Number(ship.art_id) : null;
  return {
    kind: "ship",
    id: Number(id),
    name,
    artId,
    localUrl: localAssetUrl("ship", artId),
    remoteUrl: remoteAssetUrl("ship", artId),
  };
}

export function catalogAssetById(
  kind: Exclude<GameAssetKind, "officer" | "ship">,
  id: number | null | undefined,
  data: GameData | undefined,
  label?: string,
): GameAssetRef | null {
  if (!data || !Number.isFinite(Number(id))) return null;
  const collection = (data as any)?.[kind] ?? (data as any)?.[`${kind}_summary`];
  const entry = Array.isArray(collection)
    ? collection.find((item: any) => Number(item?.id) === Number(id))
    : collection?.[Number(id)];
  const artId = Number.isFinite(Number(entry?.art_id)) ? Number(entry.art_id) : null;
  if (!entry && !artId) return null;
  return {
    kind,
    id: Number(id),
    name: label ?? `${kind.replace(/_/g, " ")} ${id}`,
    artId,
    localUrl: localAssetUrl(kind, artId),
    remoteUrl: remoteAssetUrl(kind, artId),
  };
}

export function initialsForName(name: string) {
  const words = normalizeName(name).split(" ").filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}
