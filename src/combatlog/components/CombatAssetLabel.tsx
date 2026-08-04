import * as React from "react";
import { Box, Stack, Typography } from "@mui/material";

import { GameAssetAvatar } from "../../components/GameAssetAvatar";
import type { GameData } from "../util/combatLog";
import {
  catalogAssetById,
  officerAssetById,
  resolveOfficerAsset,
  resolveShipAsset,
  shipAssetById,
  type GameAssetKind,
} from "../../util/gameAssets";

type CombatAssetLabelProps = {
  data: GameData;
  label: string;
  secondary?: string;
  kind: GameAssetKind;
  id?: number | null;
  size?: number;
  captain?: boolean;
};

export function CombatAssetLabel({
  data,
  label,
  secondary,
  kind,
  id,
  size = 34,
  captain = false,
}: CombatAssetLabelProps) {
  const asset =
    kind === "ship"
      ? shipAssetById(id, data) ?? resolveShipAsset(label, data)
      : kind === "officer"
        ? officerAssetById(id, data) ?? resolveOfficerAsset(label, data)
        : catalogAssetById(kind, id, data, label);
  const text = [label, secondary].filter(Boolean).join(" ");

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      data-text={text}
      title={text}
      sx={{ minWidth: 0, maxWidth: 280 }}
    >
      <GameAssetAvatar asset={asset} label={label} size={size} captain={captain} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: captain ? 700 : 500 }}>
          {label}
        </Typography>
        {secondary ? (
          <Typography variant="caption" noWrap color="text.secondary" sx={{ display: "block" }}>
            {secondary}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}
