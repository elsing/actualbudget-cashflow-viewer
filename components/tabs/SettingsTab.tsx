"use client";
import type { UiState, AppData, AppState } from "@/types";
import { C, FONT } from "@/lib/constants";
import CalibrationTab from "./CalibrationTab";

interface SettingsTabProps {
  data: AppData;
  reconciliations: AppState["reconciliations"];
  onReconciliationsChange: (r: AppState["reconciliations"]) => void;
  uiState?: Partial<UiState>;
  setUi?: (patch: Partial<UiState>) => void;
}

export default function SettingsTab({
  data, reconciliations, onReconciliationsChange,
  uiState = {}, setUi = () => {},
}: SettingsTabProps) {
  const settledDay = uiState.settledDay ?? 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Section: Display */}
      <section>
        <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 3, marginBottom: 16 }}>DISPLAY</div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                Settled balance day
              </div>
              <div style={{ color: C.textDim, fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>
                Month cards show the balance at the end of this day rather than the raw start-of-month balance.
                This accounts for bills that land on the 2nd or 3rd due to weekends or bank holidays —
                giving a more realistic picture of what you actually have available for the month.
              </div>
              <div style={{ color: C.muted, fontSize: 11 }}>
                Day 1 = true start (same as previous month end) · Day 5 = after most regular bills
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
              <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 2 }}>DAY OF MONTH</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="number" min={1} max={10} value={settledDay}
                  onChange={e => setUi({ settledDay: Math.max(1, Math.min(10, parseInt(e.target.value) || 5)) })}
                  style={{ width: 72, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7,
                    padding: "10px 14px", color: C.amber, fontSize: 18, fontWeight: 700,
                    fontFamily: FONT, outline: "none", textAlign: "center" }}
                />
                <div style={{ color: C.textDim, fontSize: 12 }}>
                  {settledDay === 1 ? "true start of month" : `balance after day ${settledDay}`}
                </div>
              </div>
              <button onClick={() => setUi({ settledDay: 5 })}
                style={{ background: "transparent", border: "none", color: C.muted,
                  fontSize: 10, cursor: "pointer", fontFamily: FONT, padding: 0 }}>
                reset to default (5)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Calibration */}
      <section>
        <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 3, marginBottom: 16 }}>CALIBRATION</div>
        <CalibrationTab
          data={data}
          reconciliations={reconciliations}
          onReconciliationsChange={onReconciliationsChange}
        />
      </section>

    </div>
  );
}
