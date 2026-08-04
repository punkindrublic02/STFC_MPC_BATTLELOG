function text(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
    return String(value);
}

export function buildShipsText(parsedData: any, _gameData?: any): string {
    const ships = parsedData?.allShips ?? [];

    const lines: string[] = [];

    lines.push([
        "Ship",
        "Side",
        "Ship ID",
        "Player ID",
        "Hull",
        "Shield",
        "Level",
        "Class",
    ].join("\t"));

    for (const ship of ships) {
        const hull =
            ship?.finalHhp !== undefined && ship?.maxHhp !== undefined
                ? `${text(ship.finalHhp)} / ${text(ship.maxHhp)}`
                : "";

        const shield =
            ship?.finalShp !== undefined && ship?.maxShp !== undefined
                ? `${text(ship.finalShp)} / ${text(ship.maxShp)}`
                : "";

        lines.push([
            text(ship?.displayName ?? ship?.name ?? ship?.shipName ?? "Unknown"),
            text(ship?.side),
            text(ship?.shipId),
            text(ship?.playerId),
            hull,
            shield,
            text(ship?.level ?? ship?.shipLevel),
            text(ship?.class ?? ship?.shipClass),
        ].join("\t"));
    }

    return lines.join("\n");
}