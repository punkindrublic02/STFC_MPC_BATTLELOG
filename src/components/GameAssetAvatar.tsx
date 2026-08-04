import * as React from "react";
import { Avatar, Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

import type { GameAssetRef } from "../util/gameAssets";
import { initialsForName } from "../util/gameAssets";

type GameAssetAvatarProps = {
  asset: GameAssetRef | null;
  label: string;
  size?: number;
  variant?: "avatar" | "chip" | "seat";
  captain?: boolean;
  color?: "default" | "primary" | "secondary" | "warning";
};

export function GameAssetAvatar({
  asset,
  label,
  size = 34,
  variant = "avatar",
  captain = false,
  color = "default",
}: GameAssetAvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const src = !failed ? asset?.remoteUrl ?? asset?.localUrl ?? undefined : undefined;
  const title = asset?.artId
    ? `${label} - art ${asset.artId}`
    : `${label} - no mapped art yet`;
  const fallback = asset?.kind === "ship" ? <RocketLaunchIcon fontSize="small" /> : initialsForName(label);

  const avatar = (
    <Tooltip title={title}>
      <Avatar
        src={src}
        imgProps={{ onError: () => setFailed(true) }}
        sx={{
          width: size,
          height: size,
          border: "1px solid",
          borderColor: captain ? "secondary.main" : "divider",
          bgcolor: captain ? "secondary.main" : asset?.kind === "ship" ? "primary.dark" : "background.paper",
          color: captain ? "secondary.contrastText" : "text.primary",
          fontSize: Math.max(11, Math.round(size * 0.34)),
          fontWeight: 700,
        }}
      >
        {fallback}
      </Avatar>
    </Tooltip>
  );

  if (variant === "chip") {
    return (
      <Chip
        avatar={avatar}
        label={label}
        color={color}
        size="small"
        variant={color === "default" ? "outlined" : "filled"}
      />
    );
  }

  if (variant === "seat") {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        {avatar}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap title={label}>
            {label}
          </Typography>
          {asset?.artId ? (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              art {asset.artId}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    );
  }

  return avatar;
}
