function text(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
    return String(value);
}

function pct(value: unknown): string {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    return `${value.toFixed(2)}%`;
}

export function buildOverviewText(parsedData: any, _gameData?: any): string {
    const lines: string[] = [];

    const ships = parsedData?.allShips ?? [];
    const initiatorShips = ships.filter((s: any) => s?.side === "initiator");
    const targetShips = ships.filter((s: any) => s?.side === "target");

    lines.push("Field\tValue");
    lines.push(`Ships involved\t${text(ships.length)}`);
    lines.push(`Initiator ships\t${text(initiatorShips.length)}`);
    lines.push(`Target ships\t${text(targetShips.length)}`);

    lines.push("");
    lines.push("Ship\tSide\tHull\tShield");

    for (const ship of ships) {
        const name = text(ship?.displayName ?? ship?.name ?? ship?.shipName ?? "Unknown");
        const side = text(ship?.side ?? "");

        const hull =
            ship?.finalHhp !== undefined && ship?.maxHhp !== undefined
                ? `${text(ship.finalHhp)} / ${text(ship.maxHhp)}`
                : text(ship?.hull ?? "");

        const shield =
            ship?.finalShp !== undefined && ship?.maxShp !== undefined
                ? `${text(ship.finalShp)} / ${text(ship.maxShp)}`
                : text(ship?.shield ?? "");

        lines.push(`${name}\t${side}\t${hull}\t${shield}`);
    }

    return lines.join("\n");
}