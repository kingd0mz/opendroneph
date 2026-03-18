import { Box, Chip, Divider, Stack, Typography } from "@mui/material";

interface DatasetPopupCardProps {
  title: string;
  dataType: string;
  createdAt: string;
}

export function DatasetPopupCard({
  title,
  dataType,
  createdAt,
}: DatasetPopupCardProps) {
  return (
    <Box sx={{ minWidth: 240, p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Chip
          label={dataType}
          size="small"
          sx={{
            alignSelf: "flex-start",
            bgcolor: "secondary.main",
            color: "common.white",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        />
        <Divider />
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Created
          </Typography>
          <Typography variant="body2">
            {new Date(createdAt).toLocaleString()}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
