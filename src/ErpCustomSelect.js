import React from "react";
import { Check, ChevronDown } from "lucide-react";

function ErpCustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select option",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const listboxIdRef = React.useRef(`erp-custom-select-${Math.random().toString(36).slice(2, 10)}`);

  const selectedOption = (Array.isArray(options) ? options : []).find(
    (option) => String(option.value) === String(value)
  ) || null;

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`erp-custom-select ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`.trim()}
    >
      <button
        type="button"
        className="erp-custom-select-trigger"
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxIdRef.current}
        disabled={disabled}
      >
        <span
          className={`erp-custom-select-value ${selectedOption ? "" : "is-placeholder"}`.trim()}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={16} className="erp-custom-select-icon" />
      </button>
      {isOpen && (
        <div className="erp-custom-select-menu" id={listboxIdRef.current} role="listbox">
          {(Array.isArray(options) ? options : []).map((option) => {
            const isSelected = String(option.value) === String(value);
            return (
              <button
                key={`${listboxIdRef.current}-${option.value}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`erp-custom-select-option ${isSelected ? "is-selected" : ""}`.trim()}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={14} className="erp-custom-select-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ErpCustomSelect;
