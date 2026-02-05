import { useEffect, useState } from "react";
import { bindModalHandler, type ModalRequest } from "../utils/confirm";

export function ConfirmModalHost() {
    const [request, setRequest] = useState<ModalRequest | null>(null);

    useEffect(() => {
        return bindModalHandler(setRequest);
    }, []);

    if (!request) return null;

    const isConfirm = request.type === "confirm";

    return (
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                    request.resolve(false);
                    setRequest(null);
                }
            }}
        >
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/5 p-6 text-slate-100 shadow-2xl backdrop-blur-xl">
                <div className="text-sm font-semibold text-slate-100">Confirmation</div>
                <div className="mt-3 text-sm text-slate-200">{request.message}</div>
                <div className="mt-5 flex justify-end gap-2">
                    {isConfirm && (
                        <button
                            type="button"
                            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                            onClick={() => {
                                request.resolve(false);
                                setRequest(null);
                            }}
                        >
                            Annuler
                        </button>
                    )}
                    <button
                        type="button"
                        className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110"
                        onClick={() => {
                            request.resolve(true);
                            setRequest(null);
                        }}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
