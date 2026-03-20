import { Box, Stack, Typography } from "@mui/material";

import { BRAND_COPY } from "../content/brandCopy";

export function HeaderBrand() {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        component="img"
        src="/philsa-logo.png"
        alt="Philippine Space Agency logo"
        sx={{
          width: 42,
          height: 42,
          objectFit: "contain",
          flexShrink: 0,
        }}
      />

      <Box>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.72)", display: "block", lineHeight: 1.1 }}>
          Philippine Space Agency
        </Typography>
        <Typography variant="h6" component="div" sx={{ color: "common.white", fontWeight: 800, lineHeight: 1.05 }}>
          {BRAND_COPY.platformTitle}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.76)",
            display: { xs: "none", lg: "block" },
            lineHeight: 1.1,
            mt: 0.2,
          }}
        >
          {BRAND_COPY.platformSubtitle}
        </Typography>
      </Box>

      <Box
        component="img"
        src="/bagong_pilipinas_logo.png"
        alt="Bagong Pilipinas logo"
        sx={{
          ml: 1,
          height: 34,
          width: "auto",
          objectFit: "contain",
          display: { xs: "none", md: "block" },
        }}
      />
    </Stack>
  );
}
