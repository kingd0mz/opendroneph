import { Stack } from "@mui/material";

import { AOICard } from "./AOICard";
import type { AOI } from "../../types/dataset";

interface AOIListProps {
  aois: AOI[];
  focusedAoiId: string | null;
  onFocus: (aoiId: string) => void;
  onHover: (aoiId: string | null) => void;
}

export function AOIList({ aois, focusedAoiId, onFocus, onHover }: AOIListProps) {
  return (
    <Stack spacing={1.5}>
      {aois.map((aoi) => (
        <AOICard
          key={aoi.id}
          aoi={aoi}
          isFocused={focusedAoiId === aoi.id}
          onFocus={onFocus}
          onHover={onHover}
        />
      ))}
    </Stack>
  );
}
