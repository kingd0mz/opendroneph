import { FullscreenState } from "./components/FullscreenState";
import { usePathname } from "./hooks/usePathname";
import { MapShell } from "./layout/MapShell";
import { DatasetDetailPage } from "./pages/DatasetDetailPage";
import { JobsPage } from "./pages/JobsPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { MapPage } from "./pages/MapPage";
import { ProfilePage } from "./pages/ProfilePage";
import { UploadPage } from "./pages/UploadPage";

function App() {
  const pathname = usePathname();
  const datasetMatch = pathname.match(/^\/datasets\/([^/]+)\/?$/);
  const userMatch = pathname.match(/^\/users\/([^/]+)\/?$/);

  let page = <MapPage />;
  if (pathname === "/profile") {
    page = <ProfilePage />;
  } else if (pathname === "/jobs") {
    page = <JobsPage />;
  } else if (pathname === "/upload") {
    page = <UploadPage />;
  } else if (pathname === "/leaderboard") {
    page = <LeaderboardPage />;
  } else if (userMatch) {
    page = <ProfilePage userId={userMatch[1] ?? null} />;
  } else if (datasetMatch) {
    page = <DatasetDetailPage datasetId={datasetMatch[1] ?? null} />;
  } else if (pathname !== "/") {
    page = (
      <FullscreenState
        title="Page Not Found"
        description="The requested page does not exist."
        severity="warning"
      />
    );
  }

  return (
    <MapShell>
      {page}
    </MapShell>
  );
}

export default App;
