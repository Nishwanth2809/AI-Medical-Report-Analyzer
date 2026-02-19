import { useState } from "react";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";
import type { ApiResponse } from "./api/types";

export default function App() {
  const [result, setResult] = useState<ApiResponse | null>(null);

  return result ? (
    <ResultsPage data={result} onBack={() => setResult(null)} />
  ) : (
    <UploadPage onDone={setResult} />
  );
}
