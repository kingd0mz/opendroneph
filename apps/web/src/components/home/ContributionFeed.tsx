import { Avatar, Box, Card, CardContent, Stack, Typography } from "@mui/material";

import { navigate } from "../../hooks/usePathname";

export interface ContributionFeedItem {
  id: string;
  title: string;
  contributor: string;
  createdAt: string;
  dataType: string;
}

interface ContributionFeedProps {
  items: ContributionFeedItem[];
}

export function ContributionFeed({ items }: ContributionFeedProps) {
  return (
    <Stack spacing={1.2}>
      {items.map((item) => (
        <Card
          key={item.id}
          sx={{
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(15,93,94,0.08)",
            cursor: "pointer",
          }}
          onClick={() => navigate(`/datasets/${item.id}`)}
        >
          <CardContent sx={{ p: 1.6 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                variant="rounded"
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: item.dataType === "orthophoto" ? "#1f7f69" : "#8b6b3d",
                  color: "common.white",
                  fontWeight: 800,
                }}
              >
                {item.dataType === "orthophoto" ? "ORT" : "RAW"}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                  {item.title}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
                  {item.contributor}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
