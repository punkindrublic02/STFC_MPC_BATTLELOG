import * as React from "react";
import { Link } from "@mui/material";

const urlPattern = /((?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/gi;

function hrefFor(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function AutoLinkText({ value }: { value: unknown }) {
  const text = value === null || value === undefined || value === "" ? "n/a" : String(value);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlPattern)) {
    const url = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    parts.push(
      <Link key={`${url}-${index}`} href={hrefFor(url)} target="_blank" rel="noreferrer">
        {url}
      </Link>,
    );
    lastIndex = index + url.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}
