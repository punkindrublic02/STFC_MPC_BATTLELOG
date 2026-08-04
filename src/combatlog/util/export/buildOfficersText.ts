import { lookupOfficer } from "../combatLog";

function text(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
    return String(value);
}

function officerName(officerId: number | undefined, gameData: any): string {
    if (!officerId) return "";
    return lookupOfficer(officerId, gameData)?.officerName ?? "";
}

export function buildOfficersRows(parsedData: any, gameData?: any) {
    const ships = parsedData?.allShips ?? [];
    const rows: any[] = [];

    for (const ship of ships) {
        const officers = ship?.fleetData?.fleets_officers?.[ship?.fleetId] ?? [];

        officers.forEach((officer: any, index: number) => {
            if (!officer) return;

            const slotLabel =
                index === 0
                    ? "captain"
                    : index === 1
                        ? "bridge 1"
                        : index === 2
                            ? "bridge 2"
                            : `below deck ${index - 2}`;

            rows.push({
                ship: text(ship?.displayName ?? ship?.name ?? ship?.shipName ?? "Unknown"),
                side: text(ship?.side),
                slot: index + 1,
                slot_label: slotLabel,
                bridge: index < 3,
                officer_id: officer?.id ?? null,
                officer_name: officerName(officer?.id, gameData),
                level: officer?.level ?? null,
                rank: officer?.rank ?? null,
            });
        });
    }

    return rows;
}

export function buildOfficersText(parsedData: any, gameData?: any): string {
    const lines: string[] = [];

    lines.push([
        "Ship",
        "Side",
        "Slot",
        "Slot Label",
        "Bridge",
        "Officer ID",
        "Officer Name",
        "Level",
        "Rank",
    ].join("\t"));

    for (const row of buildOfficersRows(parsedData, gameData)) {
        lines.push([
            row.ship,
            row.side,
            text(row.slot),
            row.slot_label,
            row.bridge ? "yes" : "no",
            text(row.officer_id),
            row.officer_name,
            text(row.level),
            text(row.rank),
        ].join("\t"));
    }

    return lines.join("\n");
}
