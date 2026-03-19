import { Box, Chip, Stack, Typography } from "@mui/material";

import { BRAND_COPY } from "../content/brandCopy";

export function HeaderBrand() {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          position: "relative",
          background: "radial-gradient(circle at 30% 30%, #F2C94C 0%, #D6AE2A 42%, #0B1F3A 43%, #142C54 100%)",
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 7,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.78)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: 8,
            right: 8,
            top: 18,
            height: 2,
            bgcolor: "rgba(255,255,255,0.85)",
            transform: "rotate(-22deg)",
          }}
        />
      </Box>

      <Box>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.72)", display: "block", lineHeight: 1.1 }}>
          PhilSA
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

      <Chip
        label="Bagong Pilipinas"
        size="small"
        sx={{
          ml: 1,
          bgcolor: "rgba(255,255,255,0.1)",
          color: "common.white",
          border: "1px solid rgba(255,255,255,0.14)",
          fontWeight: 700,
          display: { xs: "none", md: "inline-flex" },
        }}
      />
    </Stack>
  );
}
