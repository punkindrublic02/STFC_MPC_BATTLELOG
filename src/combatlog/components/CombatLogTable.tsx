import * as React from "react";
import {
  Table,
  TableContainer,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
  TextField,
  Paper,
} from "@mui/material";
import { tableCellClasses } from "@mui/material/TableCell";
import { styled } from "@mui/material/styles";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));

export interface ColumnDefinition {
  label: React.ReactNode;
  align: "inherit" | "left" | "center" | "right" | "justify";
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
}

export type CombatLogCell = string | number | undefined | React.ReactNode;

export interface CombatLogTableProps {
  columns: ColumnDefinition[];
  data: {
    cells: CombatLogCell[];
  }[];
  raw_json?: boolean;
  dense?: boolean;
  maxHeight?: number | string;
}

function cellToText(cell: CombatLogCell) {
  if (typeof cell === "string") return cell;
  if (typeof cell === "number") return cell.toLocaleString();
  if (cell === undefined || cell === null) return "???";
  if (React.isValidElement(cell)) {
    const props = cell.props as { "data-text"?: unknown; title?: unknown; children?: unknown };
    if (typeof props["data-text"] === "string") return props["data-text"];
    if (typeof props.title === "string") return props.title;
  }
  return "";
}

export function CombatLogTable(props: CombatLogTableProps): React.JSX.Element {
  const { columns, data, raw_json, dense = true, maxHeight = "calc(100vh - 190px)" } = props;

  if (raw_json) {
    const content = [columns.map((c) => cellToText(c.label)), ...data.map((d) => d.cells.map(cellToText))]
      .map((row) => row.map((cell) => `"${cell.replace('"', "'")}"`).join(", "))
      .join("\n");

    return (
      <TextField
        defaultValue={content}
        fullWidth
        multiline
        rows={32}
        InputProps={{
          readOnly: true,
        }}
        variant="filled"
      />
    );
  } else {
    return (
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: "100%",
          maxHeight,
          overflow: "auto",
        }}
      >
        <Table
          size={dense ? "small" : "medium"}
          stickyHeader
          sx={{
            width: "100%",
            minWidth: 0,
            tableLayout: "fixed",
            "& .MuiTableCell-root": {
              px: dense ? 0.75 : 1.25,
              py: dense ? 0.5 : 0.85,
              fontSize: dense ? "0.73rem" : "0.875rem",
              lineHeight: 1.2,
              verticalAlign: "top",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            },
            "& .MuiTableCell-head": {
              fontSize: dense ? "0.68rem" : "0.8rem",
              fontWeight: 700,
            },
          }}
        >
          <TableHead>
            <TableRow>
              {columns.map((col, i) => (
                <StyledTableCell
                  align={col.align}
                  key={i}
                  sx={{
                    width: col.width,
                    minWidth: col.minWidth,
                    maxWidth: col.maxWidth,
                  }}
                >
                  {col.label}
                </StyledTableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                {row.cells.map((cell, j) => (
                  <StyledTableCell
                    key={j}
                    align={columns[j]?.align ?? "left"}
                    sx={{
                      width: columns[j]?.width,
                      minWidth: columns[j]?.minWidth,
                      maxWidth: columns[j]?.maxWidth,
                    }}
                  >
                    {cell}
                  </StyledTableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
}
