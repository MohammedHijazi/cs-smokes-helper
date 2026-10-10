import { Route, Routes } from "react-router";
import { HomePage } from "../features/home/HomePage";
import { MapPage } from "../features/map/MapPage";
import { Layout } from "./Layout";
import { NotFound } from "./NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="maps/:mapId" element={<MapPage />} />
        <Route path="maps/:mapId/smokes/:lineupId" element={<MapPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
