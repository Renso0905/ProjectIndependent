"use client";
export default function EndSessionFooter({
  ending,
  sessionActive,
  onEnd,
  onSaveExit,
  onCancel,
}: {
  ending: boolean;
  sessionActive: boolean;
  onEnd: () => void;
  onSaveExit: () => void;
  onCancel: () => void;
}) {
  return (
    <footer className="pt-2">
      {!ending ? (
        <button
          disabled={!sessionActive}
          onClick={onEnd}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          End Session
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-gray-700">Finish and save?</span>
          <button onClick={onSaveExit} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Save & Exit
          </button>
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
        </div>
      )}
    </footer>
  );
}
