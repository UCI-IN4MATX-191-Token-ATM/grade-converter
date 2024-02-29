
import { HashRouter, Route, Routes } from "react-router-dom";
import CanvasServiceContext, { CanvasService } from "./services/canvas-service";
import MainPage from "./pages/main/main-page";
import RegisterPage from "./pages/register/register-page";
import SecureStorageServiceContext, { SecureStorageService } from "./services/secure-storage-service";
import LoginPage from "./pages/login/login-page";

function App() {
  const canvasService = new CanvasService();
  const secureStorageService = new SecureStorageService();
  return (
    <>
      <h1 className="center mx-auto text-center text-5xl mb-5">Grade Converter</h1>
      <SecureStorageServiceContext.Provider value={secureStorageService}>
        <CanvasServiceContext.Provider value={canvasService}>
          <HashRouter>
            <Routes>
              <Route path="/" element={<MainPage />}></Route>
              <Route path="/login" element={<LoginPage />}></Route>
              <Route path="/register" element={<RegisterPage />}></Route>
            </Routes>
          </HashRouter>
        </CanvasServiceContext.Provider>
      </SecureStorageServiceContext.Provider>
    </>
  )
}

export default App
