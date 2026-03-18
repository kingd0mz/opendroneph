import { FullscreenState } from "./components/FullscreenState";
import { usePathname } from "./hooks/usePathname";
import { MapShell } from "./layout/MapShell";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { MapPage } from "./pages/MapPage";
import { ProfilePage } from "./pages/ProfilePage";

function App() {
  const pathname = usePathname();

  let page = <MapPage />;
  if (pathname === "/profile") {
    page = <ProfilePage />;
  } else if (pathname === "/leaderboard") {
    page = <LeaderboardPage />;
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
