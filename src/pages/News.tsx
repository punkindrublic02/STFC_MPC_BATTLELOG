import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";

// Helper functions to clean up raw WordPress/STFC post text directly in the browser
function stripHtml(value: any): string {
    return String(value ?? "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&#8217;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#038;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeNewsPayload(item: any) {
    if (!item) return null;
    return {
        title: stripHtml(item.title?.rendered ?? item.title),
        summary: item.excerpt?.rendered ? stripHtml(item.excerpt.rendered) : null,
        body_text: item.content?.rendered ? stripHtml(item.content.rendered) : null,
        url: item.link ?? null,
        image_url: item._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        published_at: item.date_gmt ?? item.date ?? null,
    };
}

type NewsItem = {
  news_id: string;
  source: string;
  category: string | null;
  title: string;
  summary: string | null;
  body_text: string | null;
  url: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function News() {
  const [accessToken, setAccessToken] = React.useState(() => localStorage.getItem("stfcBattleAccessToken") ?? "");
  const trimmedAccessToken = accessToken.trim();

  const updateAccessToken = React.useCallback((value: string) => {
    setAccessToken(value);
    const trimmed = value.trim();
    if (trimmed) {
      localStorage.setItem("stfcBattleAccessToken", trimmed);
    } else {
      localStorage.removeItem("stfcBattleAccessToken");
    }
  }, []);

  const news = useQuery({
    queryKey: ["stfc-news", trimmedAccessToken],
    queryFn: async () => {
      const res = await fetch(`${LOCAL_SYNC_BASE_URL}/news?limit=100`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!res.ok) {
        throw new Error(res.status === 401 || res.status === 403
          ? "Enter a valid access token to load news"
          : `Could not load news: ${res.status}`);
      }
      return await res.json() as { count: number; news: NewsItem[] };
    },
    enabled: !!trimmedAccessToken,
    refetchInterval: 300000,
  });

  return (
    <Frame title="STFC News">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            STFC News
          </Typography>
          <Typography color="text.secondary">
            Official news and patch notes captured for reference. In-game events live under Alliance Events when that sync feed is available.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            label="Access token"
            type="password"
            value={accessToken}
            onChange={(event) => updateAccessToken(event.target.value)}
            size="small"
            sx={{ maxWidth: 520 }}
            fullWidth
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => news.refetch()}
            disabled={!trimmedAccessToken || news.isFetching}
          >
            Refresh
          </Button>
        </Stack>

        {!trimmedAccessToken ? <Alert severity="info">Enter your alliance token to load stored news.</Alert> : null}
        {news.isError ? <Alert severity="error">{news.error instanceof Error ? news.error.message : "Could not load news"}</Alert> : null}

        <Stack spacing={1.5}>
          {(news.data?.news ?? []).map((item) => (
            <Card key={item.news_id} variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {item.title}
                    </Typography>
                    <Chip size="small" label={item.source.replace(/_/g, " ")} />
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {item.category ? <Chip size="small" label={item.category} /> : null}
                    {item.published_at ? <Chip size="small" label={`Published ${formatDate(item.published_at)}`} /> : null}
                  </Stack>

                  {(item.summary || item.body_text) ? (
                    <Typography color="text.secondary">
                      {item.summary || item.body_text}
                    </Typography>
                  ) : null}

                  {item.url ? (
                    <Button size="small" component={Link} href={item.url} target="_blank" rel="noreferrer" sx={{ alignSelf: "flex-start" }}>
                      Open
                    </Button>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {trimmedAccessToken && !news.isLoading && !news.data?.news?.length ? (
          <Alert severity="info">No news rows have been captured yet.</Alert>
        ) : null}
      </Stack>
    </Frame>
  );
}
