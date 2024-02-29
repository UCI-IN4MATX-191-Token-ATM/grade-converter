import { useEffect, useState } from "react";
import exportDataAsCSV from "../util/csv-export-helper";

const DataArrayCSVExporter = ({ data, filename }: { data: Record<string, any>[]; filename: string; }) => {
  const [file, setFile] = useState<File | undefined>();
  useEffect(() => {
    const file = exportDataAsCSV(data, filename);
    setFile(file);
  }, [data, filename]);

  const onClick = () => {
    if (file === undefined) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.name);
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }
  return <button className="btn-primary-outline my-2" disabled={file === undefined} onClick={onClick}>{file !== undefined ? "Download Report" : "Preparing the Report"}</button>;
};

export default DataArrayCSVExporter;
