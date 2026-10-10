import { Route, Routes } from "react-router";
import { HomePage } from "../features/home/HomePage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { MapPage } from "../features/map/MapPage";
import { StudyPage } from "../features/study/StudyPage";
import { Layout } from "./Layout";
import { NotFound } from "./NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="maps/:mapId" element={<MapPage />} />
        <Route path="maps/:mapId/smokes/:lineupId" element={<MapPage />} />
        <Route path="maps/:mapId/executes/:executeId" element={<MapPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
