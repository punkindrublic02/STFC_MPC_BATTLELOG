import * as React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { About } from "./pages/About";
import { AdminTokens } from "./pages/AdminTokens";
import { Mitigation } from "./pages/Mitigation";
import { CombatLogNew } from "./combatlog/components/CombatLog";
import { CombatLogs } from "./pages/CombatLogs";
import { OfficerSetups } from "./pages/OfficerSetups";
import { Simulator } from "./pages/Simulator";
import { OriginSector } from "./pages/OriginSector";
import { Leslie } from "./pages/Leslie";
import { GameMechanics } from "./pages/GameMechanics";
import { Scrapping } from "./pages/Scrapping";
import { HostilesByHhp } from "./pages/HostilesByHhp";
import { ShipComparison } from "./pages/ShipComparison";
import { AllianceEvents } from "./pages/AllianceEvents";
import { AllianceTournaments } from "./pages/AllianceTournaments";
import { QuickScans } from "./pages/QuickScans";
import { News } from "./pages/News";
import { BattleStats } from "./pages/BattleStats";
import { AllianceStart } from "./pages/AllianceStart";
import { MyBattles } from "./pages/MyBattles";
import { TerritoryRefresh } from "./pages/TerritoryRefresh";
import { RunInsights } from "./pages/RunInsights";
import { BattleInsight } from "./pages/BattleInsight";
import { VgerExcelsiorGuide } from "./pages/VgerExcelsiorGuide";
import { BattleCompare } from "./pages/BattleCompare";
import { ParserDiagnostics } from "./pages/ParserDiagnostics";
import { StfcAiAssist } from "./pages/StfcAiAssist";

const queryClient = new QueryClient();

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<AllianceStart />} />
                    <Route path="/player-start" element={<AllianceStart />} />
                    <Route path="/alliance-start" element={<AllianceStart />} />
                    <Route path="/my-battles" element={<MyBattles />} />
                    <Route path="/stfc-ai-assist" element={<StfcAiAssist />} />
                    <Route path="/battle-insights/:id" element={<BattleInsight />} />
                    <Route path="/mitigation" element={<Mitigation />} />

                    <Route path="/combatlogs" element={<CombatLogs />} />
                    <Route path="/combatlogs/:id" element={<CombatLogNew />} />

                    <Route path="/combatlog" element={<CombatLogNew />} />
                    <Route path="/combatlog/:id" element={<CombatLogNew />} />
                    <Route path="/officer-setups" element={<OfficerSetups />} />

                    <Route path="/about" element={<About />} />
                    <Route path="/admin/tokens" element={<AdminTokens />} />
                    <Route path="/simulator" element={<Simulator />} />
                    <Route path="/origin-sector" element={<OriginSector />} />
                    <Route path="/leslie" element={<Leslie />} />
                    <Route path="/scrapping" element={<Scrapping />} />
                    <Route path="/game-mechanics" element={<GameMechanics />} />
                    <Route path="/armada-bug" element={<GameMechanics />} />
                    <Route path="/spock-bug" element={<GameMechanics />} />
                    <Route path="/armada-duplicate-officers" element={<GameMechanics />} />
                    <Route path="/hostiles-by-hhp" element={<HostilesByHhp />} />
                    <Route path="/ship-comparison" element={<ShipComparison />} />
                    <Route path="/battle-compare" element={<BattleCompare />} />
                    <Route path="/parser-diagnostics" element={<ParserDiagnostics />} />
                    <Route path="/run-insights" element={<RunInsights />} />
                    <Route path="/battle-stats" element={<BattleStats />} />
                    <Route path="/territory" element={<TerritoryRefresh />} />
                    <Route path="/tc-map" element={<TerritoryRefresh />} />
                    <Route path="/alliance-tournaments" element={<AllianceTournaments />} />
                    <Route path="/vger-excelsior" element={<VgerExcelsiorGuide />} />
                    <Route path="/alliance-events" element={<AllianceEvents />} />
                    <Route path="/quick-scans" element={<QuickScans />} />
                    <Route path="/news" element={<News />} />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}
