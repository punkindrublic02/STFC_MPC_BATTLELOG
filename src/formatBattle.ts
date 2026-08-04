export type FormattedBattle = {
    overview: {
        eventId: number;
        battleId: number | null;
        battleTime: string | null;
        initiatorId: string | null;
        targetId: string | null;
        initiatorWins: boolean;
        rounds: number;
    };
    ships: Array<{
        shipId: number;
        name: string;
        side: string;
        playerId: string;
    }>;
    summaryText: string;
};