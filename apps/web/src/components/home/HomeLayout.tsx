import { Box } from "@mui/material";
import type { PropsWithChildren, ReactNode } from "react";

interface HomeLayoutProps extends PropsWithChildren {
  sidebar: ReactNode;
  map: ReactNode;
}

export function HomeLayout({ sidebar, map }: HomeLayoutProps) {
  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: { xs: "column", lg: "row" },
        bgcolor: "#F5F7FA",
      }}
    >
      <Box
        sx={{
          width: { xs: "100%", lg: "40%" },
          maxWidth: { lg: "40%" },
          minWidth: 0,
          height: { xs: "auto", lg: "100%" },
          maxHeight: { lg: "100%" },
          overflow: "auto",
          bgcolor: "#F5F7FA",
          borderRight: { lg: "1px solid rgba(11,31,58,0.08)" },
        }}
      >
        {sidebar}
      </Box>
      <Box
        sx={{
          position: "relative",
          width: { xs: "100%", lg: "60%" },
          height: { xs: "50vh", lg: "100%" },
          minHeight: { xs: 360, lg: 0 },
          overflow: "hidden",
        }}
      >
        {map}
      </Box>
    </Box>
  );
}
