import { Route, Routes } from "react-router";
import { HomePage } from "../features/home/HomePage";
import { MapPage } from "../features/map/MapPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { StudyPage } from "../features/study/StudyPage";
import { Edit, EditBoundary } from "./editMode";
import { Layout } from "./Layout";
import { NotFound } from "./NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="maps/:mapId" element={<MapPage />} />
        <Route path="maps/:mapId/smokes/:lineupId" element={<MapPage />} />
        <Route path="maps/:mapId/executes/:executeId" element={<MapPage />} />
        {import.meta.env.DEV && Edit && (
          <>
            <Route
              path="maps/:mapId/smokes/new"
              element={
                <EditBoundary>
                  <Edit.SmokeFormPage />
                </EditBoundary>
              }
            />
            <Route
              path="maps/:mapId/smokes/:lineupId/edit"
              element={
                <EditBoundary>
                  <Edit.SmokeFormPage />
                </EditBoundary>
              }
            />
            <Route
              path="maps/:mapId/executes/new"
              element={
                <EditBoundary>
                  <Edit.ExecuteFormPage />
                </EditBoundary>
              }
            />
            <Route
              path="maps/:mapId/executes/:executeId/edit"
              element={
                <EditBoundary>
                  <Edit.ExecuteFormPage />
                </EditBoundary>
              }
            />
          </>
        )}
        <Route path="study" element={<StudyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
