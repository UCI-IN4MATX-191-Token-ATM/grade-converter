const ProgressBar = ({ progress }: { progress: number }) => {

  progress = Math.min(1, Math.max(progress, 0));

  return (
    <div className="w-full bg-gray-200 rounded-full h-4">
      <div
        className="bg-green-600 h-4 rounded-full"
        style={{ width: `${[progress * 100]}%` }}
      ></div>
    </div>
  );

}

export default ProgressBar;
