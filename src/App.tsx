import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTrash,
  FaCheck,
  FaPlus,
  FaEdit,
  FaRandom,
  FaTimes,
  FaFont,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { FaRegCalendarAlt } from "react-icons/fa";

// Types
interface Entry {
  id: string;
  title: string;
  text: string;
  date: string;
  description?: string;
  tags?: string[];
  width?: number;
  fontSize?: number;
}

interface AppContextType {
  entries: Entry[];
  addEntry: (entry: Entry) => void;
  updateEntry: (id: string, entry: Partial<Entry>) => void;
  deleteEntry: (id: string) => void;
  setNotificationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setCopiedFormat: React.Dispatch<React.SetStateAction<string>>;
  setNotificationMessage: React.Dispatch<React.SetStateAction<string>>;
}

const AppContext = createContext<AppContextType | null>(null);

// Text transformation utility
const transformText = (
  text: string,
  format: string,
  preserveMargins: boolean
) => {
  // Normalize text input to prevent successive issues with line breaks
  const normalizedText = text.replace(/\n{3,}/g, '\n\n');
  
  switch (format) {
    case "markdown":
      // Only add double spaces at the end of lines when needed for markdown
      // and only when preserveMargins is false (otherwise keep text as is)
      if (preserveMargins) {
        return normalizedText;
      } else {
        return normalizedText.split('\n').map(line => {
          // Only add double space to actual content lines that need line breaks
          return line.trim() ? line + '  ' : line;
        }).join('\n');
      }
    case "latex":
      return `\\begin{document}\n${normalizedText}\n\\end{document}`;
    case "json":
      return JSON.stringify({ content: normalizedText }, null, preserveMargins ? 2 : 0);
    case "json-separated":
      // When preserveMargins is true, we just split by explicit line breaks
      // This will be overridden in getTransformedText for the visual line breaks case
      const lines = normalizedText.split("\n");

      // Create an object with line numbers as keys
      const linesObject: Record<string, string> = {};
      lines.forEach((line, index) => {
        linesObject[`line ${index + 1}`] = line;
      });

      return JSON.stringify(linesObject, null, preserveMargins ? 2 : 0);
    case "html":
      return `<div>${normalizedText.replace(/\n/g, "<br>")}</div>`;
    default:
      return normalizedText;
  }
};

// Custom hook for resizable textarea
const useResizable = (initialWidth: number) => {
  const [width, setWidth] = useState(initialWidth);
  const ref = useRef<HTMLDivElement>(null);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent text selection during resize
      e.stopPropagation(); // Prevent event bubbling
      
      const startX = e.clientX;
      const startWidth = width;

      const doResize = (moveE: MouseEvent) => {
        moveE.preventDefault();
        const newWidth = startWidth + (moveE.clientX - startX);
        setWidth(Math.max(300, Math.min(newWidth, 1800)));
      };

      const stopResize = () => {
        document.removeEventListener("mousemove", doResize);
        document.removeEventListener("mouseup", stopResize);
        // Reset cursor across the entire document
        document.body.style.cursor = '';
      };

      // Set cursor across the entire document during resize
      document.body.style.cursor = 'ew-resize';
      document.addEventListener("mousemove", doResize);
      document.addEventListener("mouseup", stopResize);
    },
    [width]
  );

  return { width, setWidth, ref, startResize };
};

// Edit Modal Component
const EditModal: React.FC<{
  entry: Partial<Entry> | null;
  onClose: () => void;
  onSave: (
    entry: Partial<Entry> & { width?: number; fontSize?: number }
  ) => void;
}> = ({ entry, onClose, onSave }) => {
  const [title, setTitle] = useState(entry?.title || "");
  const [text, setText] = useState(entry?.text || "");
  const [fontSize, setFontSize] = useState(entry?.fontSize || 16);
  const [fontSizeInput, setFontSizeInput] = useState(String(entry?.fontSize || 16));
  const [deleteState, setDeleteState] = useState(false);
  const { width, setWidth, ref, startResize } = useResizable(
    entry?.width || 1125
  );

  const { setNotificationVisible, setNotificationMessage } = useContext(
    AppContext
  ) as AppContextType;

  // Constants for font size
  const MIN_FONT_SIZE = 8;
  const MAX_FONT_SIZE = 36;

  const handleSave = () => {
    onSave({ id: entry?.id, title, text, width, fontSize });
  };

  const handleDelete = () => {
    if (deleteState) {
      setTitle("");
      setText("");
      setDeleteState(false);
    } else {
      setDeleteState(true);
    }
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty input for typing flexibility
    setFontSizeInput(e.target.value);
    
    // If the input is not empty, try to convert to number
    if (e.target.value !== '') {
      const newSize = Number(e.target.value);
      if (!isNaN(newSize)) {
        // Apply constraints when setting the actual fontSize
        if (newSize < MIN_FONT_SIZE) {
          setFontSize(MIN_FONT_SIZE);
          setNotificationMessage(`Font size limited to minimum of ${MIN_FONT_SIZE}px`);
          setNotificationVisible(true);
          setTimeout(() => setNotificationVisible(false), 2000);
        } else if (newSize > MAX_FONT_SIZE) {
          setFontSize(MAX_FONT_SIZE);
          setNotificationMessage(`Font size limited to maximum of ${MAX_FONT_SIZE}px`);
          setNotificationVisible(true);
          setTimeout(() => setNotificationVisible(false), 2000);
        } else {
          setFontSize(newSize);
        }
      }
    }
  };

  // Sync the input when fontSize changes via buttons
  useEffect(() => {
    setFontSizeInput(String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    if (!text) setDeleteState(false);
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
    >
      <motion.div
        ref={ref}
        style={{ width }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg p-6 relative max-h-[80vh] overflow-y-auto shadow-xl"
      >
        <motion.div
          whileHover={{ scale: 1.1, rotate: 90 }}
          transition={{ duration: 0.2 }}
          className="absolute top-4 right-4"
        >
          <FaTimes
            className="cursor-pointer text-gray-500 hover:text-gray-700"
            onClick={onClose}
          />
        </motion.div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="a title..."
          className="w-full text-xl focus:outline-none mb-2 font-medium"
          style={{ fontSize }}
        />
        <div className="w-full h-px bg-gray-200 mb-4" />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Any text..."
          className="w-full resize-none focus:outline-none"
          style={{ fontSize, height: "470px" }}
        />
        {text && (
          <div className="flex justify-end gap-2 mt-2">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <FaTrash
                className={`cursor-pointer ${
                  deleteState ? "text-red-500" : "text-gray-500"
                }`}
                onClick={handleDelete}
                title="Delete entry"
              />
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <FaCheck
                className="cursor-pointer text-green-600"
                onClick={handleSave}
                title="Save entry"
              />
            </motion.div>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-gray-600 text-sm font-medium">Text Size:</span>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <FaFont
              className="cursor-pointer text-gray-500 text-xs"
              onClick={() => setFontSize(Math.max(MIN_FONT_SIZE, fontSize - 2))}
              title="Decrease font size"
            />
          </motion.div>
          <input
            type="text"
            value={fontSizeInput}
            onChange={handleFontSizeChange}
            onBlur={() => {
              // Ensure the displayed value matches the actual fontSize on blur
              setFontSizeInput(String(fontSize));
            }}
            className="w-16 p-1 border rounded text-center text-sm"
            title={`Enter font size (${MIN_FONT_SIZE}-${MAX_FONT_SIZE}px)`}
          />
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <FaFont
              className="cursor-pointer text-gray-500 text-lg"
              onClick={() => setFontSize(Math.min(MAX_FONT_SIZE, fontSize + 2))}
              title="Increase font size"
            />
          </motion.div>
        </div>
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-gray-200 hover:bg-gray-300"
          onMouseDown={startResize}
          title="Resize editor"
        />
      </motion.div>
    </motion.div>
  );
};

// Shuffle Modal Component
const ShuffleModal: React.FC<{
  text: string;
  onClose: () => void;
}> = ({ text, onClose }) => {
  const [format, setFormat] = useState("markdown");
  const [preserveMargins, setPreserveMargins] = useState(true);
  const [editedText, setEditedText] = useState(text);
  const [editedTransformed, setEditedTransformed] = useState("");

  // Access context for entries and notification functions
  const { entries, setNotificationVisible, setCopiedFormat, setNotificationMessage } = useContext(
    AppContext
  ) as AppContextType;
  const matchingEntry = entries.find((entry) => entry.text === text);
  const initialWidth = matchingEntry?.width || 1125;

  // Constants for font size
  const MIN_FONT_SIZE = 8;
  const MAX_FONT_SIZE = 36;

  // Use the matching entry's font size if available
  const [fontSize, setFontSize] = useState(matchingEntry?.fontSize || 16);
  const [fontSizeInput, setFontSizeInput] = useState(String(matchingEntry?.fontSize || 16));

  // Add resizable functionality for original text area
  const { width: originalWidth, setWidth: setOriginalWidth, startResize: startOriginalResize } = useResizable(initialWidth);

  // Create a ref for the original text area to measure its visible content
  const originalTextRef = useRef<HTMLTextAreaElement>(null);
  
  // Initialize the textareas immediately when component mounts
  useEffect(() => {
    // Initialize transformed text immediately
    const initialTransformed = transformText(text, format, preserveMargins);
    setEditedTransformed(initialTransformed);
  }, []);

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty input for typing flexibility
    setFontSizeInput(e.target.value);
    
    // If the input is not empty, try to convert to number
    if (e.target.value !== '') {
      const newSize = Number(e.target.value);
      if (!isNaN(newSize)) {
        // Apply constraints when setting the actual fontSize
        if (newSize < MIN_FONT_SIZE) {
          setFontSize(MIN_FONT_SIZE);
          setNotificationMessage(`Font size limited to minimum of ${MIN_FONT_SIZE}px`);
          setNotificationVisible(true);
          setTimeout(() => setNotificationVisible(false), 2000);
        } else if (newSize > MAX_FONT_SIZE) {
          setFontSize(MAX_FONT_SIZE);
          setNotificationMessage(`Font size limited to maximum of ${MAX_FONT_SIZE}px`);
          setNotificationVisible(true);
          setTimeout(() => setNotificationVisible(false), 2000);
        } else {
          setFontSize(newSize);
        }
      }
    }
  };

  // Sync the input when fontSize changes via buttons
  useEffect(() => {
    setFontSizeInput(String(fontSize));
  }, [fontSize]);

  // Transform text based on current settings
  const getTransformedText = useCallback(() => {
    // When NOT preserving margins, use original formatting without adding visual line breaks
    if (!preserveMargins) {
      return transformText(editedText, format, true); // Use original formatting
    }

    // When preserving margins, we need to detect the visual line breaks
    if (originalTextRef.current) {
      const textArea = originalTextRef.current;

      // Create a hidden canvas to measure text width more accurately
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        return transformText(editedText, format, false);
      }

      // Set font to match the textarea
      context.font = `${fontSize}px sans-serif`;

      // Calculate available width for text (account for padding)
      const availableWidth = textArea.clientWidth - 32; // 16px padding on each side

      // Helper function to calculate text width
      const getTextWidth = (text: string) => context.measureText(text).width;

      // Process text to add visual line breaks
      const paragraphs = editedText.split("\n");
      const transformedParagraphs = paragraphs.map((paragraph) => {
        // Skip empty paragraphs
        if (!paragraph.trim()) return "";

        const words = paragraph.split(" ");
        const lines: string[] = [];
        let currentLine = "";

        // Build lines word by word
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;

          // Check if adding this word would exceed the available width
          if (getTextWidth(testLine) <= availableWidth) {
            currentLine = testLine;
          } else {
            // Line is full, start a new one
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }

        // Add the last line if it's not empty
        if (currentLine) lines.push(currentLine);

        // Return paragraph with proper line breaks based on format
        return lines.join(format === "markdown" ? "  \n" : "\n");
      });

      // Join paragraphs with appropriate format-specific line breaks
      let result = transformedParagraphs.join("\n\n");

      // Apply format-specific transformations to the result
      switch (format) {
        case "markdown":
          return result;
        case "latex":
          return `\\begin{document}\n${result}\n\\end{document}`;
        case "json":
          return JSON.stringify({ content: result }, null, 0);
        case "json-separated":
          // For JSON separated, we want to create an object with line numbers as keys
          // First, split by all line breaks and filter out empty lines
          const allLines = result
            .split("\n")
            .filter((line) => line.trim().length > 0);

          // Create an object with line numbers as keys
          const linesObject: Record<string, string> = {};
          allLines.forEach((line, index) => {
            linesObject[`line ${index + 1}`] = line.trim();
          });

          return JSON.stringify(linesObject, null, 2);
        case "html":
          return `<div>${result.replace(/\n/g, "<br>")}</div>`;
        default:
          return result;
      }
    }

    // Fallback to basic transformation
    return transformText(editedText, format, false);
  }, [editedText, format, preserveMargins, fontSize, originalWidth]);

  // Update transformed text whenever relevant parameters change
  const [transformed, setTransformed] = useState(() => getTransformedText());

  useEffect(() => {
    const newTransformed = getTransformedText();
    setTransformed(newTransformed);
    setEditedTransformed(newTransformed);
  }, [getTransformedText]);

  // Update font size if matching entry changes
  useEffect(() => {
    if (matchingEntry?.fontSize) {
      setFontSize(matchingEntry.fontSize);
    }
  }, [matchingEntry]);

  // Calculate appropriate height for text areas
  const textLength = editedText.length;
  const textareaHeight =
    textLength > 2000 ? "450px" : textLength > 1000 ? "400px" : "350px";

  // Modal sizing - adjust transformed text width based on preserve margins setting
  const transformedWidth = !preserveMargins
    ? Math.max(400, Math.min(originalWidth * 0.8, 800))
    : originalWidth;

  const totalWidth = originalWidth + transformedWidth + 64;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editedTransformed);
    const formatDisplay = format.charAt(0).toUpperCase() + format.slice(1);
    setCopiedFormat(formatDisplay);
    onClose();
    setNotificationVisible(true);
    setTimeout(() => {
      setNotificationVisible(false);
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto"
    >
      <motion.div
        style={{ width: totalWidth, maxWidth: "95vw" }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg p-8 relative max-h-[90vh] overflow-y-auto m-auto shadow-xl"
      >
        <motion.div
          whileHover={{ scale: 1.1, rotate: 90 }}
          transition={{ duration: 0.2 }}
          className="absolute top-6 right-6"
        >
          <FaTimes
            className="cursor-pointer text-gray-500 hover:text-gray-700 text-xl"
            onClick={onClose}
          />
        </motion.div>

        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Transform Text</h2>

        <div className="flex flex-col xl:flex-row gap-6 mb-6">
          <div
            className="relative"
            style={{ width: originalWidth, minWidth: "300px" }}
          >
            <h3 className="text-lg font-medium text-gray-700 mb-3">
              Original Text:
            </h3>
            <textarea
              ref={originalTextRef}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full p-4 border rounded-lg resize-none bg-gray-50 shadow-inner"
              style={{
                fontSize,
                height: textareaHeight,
              }}
            />
            <div
              className="absolute right-0 top-10 bottom-0 w-4 cursor-ew-resize hover:bg-gray-300 z-10 flex items-center justify-center"
              onMouseDown={(e) => {
                startOriginalResize(e);
              }}
              title="Resize editor"
            >
              <div className="h-12 w-1 bg-gray-400 rounded-full"></div>
            </div>
          </div>

          <div
            style={{
              width: transformedWidth,
              minWidth: "300px",
              maxWidth: !preserveMargins ? "800px" : "none",
            }}
          >
            <h3 className="text-lg font-medium text-gray-700 mb-3">
              Transformed Text:
            </h3>
            <textarea
              value={editedTransformed}
              onChange={(e) => setEditedTransformed(e.target.value)}
              className="w-full p-4 border rounded-lg resize-none shadow-inner"
              style={{
                fontSize,
                height: textareaHeight,
                whiteSpace: !preserveMargins ? "pre-wrap" : "pre",
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 mb-6">
          <div className="= py-2 px-4 rounded flex items-center h-12">
            <label className="text-gray-600 font-medium mr-6">Format:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-48 p-3 border rounded text-base bg-white shadow-sm"
            >
              <option value="markdown">Markdown</option>
              <option value="latex">LaTeX</option>
              <option value="json">JSON</option>
              <option value="json-separated">JSON (separated)</option>
              <option value="html">HTML</option>
            </select>
          </div>

          <div className="bg-gray-50 py-1 px-4 rounded border shadow-sm flex items-center h-12">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preserveMargins}
                onChange={(e) => setPreserveMargins(e.target.checked)}
                className="mr-3 h-4 w-4"
              />
              <span className="text-base font-medium">Preserve margins</span>
            </label>
          </div>

          <div className="bg-gray-50 py-1 px-4 rounded border shadow-sm flex items-center h-12">
            <span className="text-gray-600 font-medium mr-3">Text Size:</span>
            <div className="flex items-center gap-2">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <FaFont
                  className="cursor-pointer text-gray-500 text-xs"
                  onClick={() => setFontSize(Math.max(MIN_FONT_SIZE, fontSize - 2))}
                />
              </motion.div>
              <input
                type="text"
                value={fontSizeInput}
                onChange={handleFontSizeChange}
                onBlur={() => {
                  // Ensure the displayed value matches the actual fontSize on blur
                  setFontSizeInput(String(fontSize));
                }}
                className="w-16 p-1 border rounded text-center text-sm"
                title={`Enter font size (${MIN_FONT_SIZE}-${MAX_FONT_SIZE}px)`}
              />
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <FaFont
                  className="cursor-pointer text-gray-500 text-lg"
                  onClick={() => setFontSize(Math.min(MAX_FONT_SIZE, fontSize + 2))}
                />
              </motion.div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors text-base font-medium"
          >
            Dismiss
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={copyToClipboard}
            className="ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base font-medium shadow-sm"
          >
            Copy
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Options Modal Component
const OptionsModal: React.FC<{
  entry: Entry;
  onClose: () => void;
  onSave: (entry: Partial<Entry>) => void;
}> = ({ entry, onClose, onSave }) => {
  const [description, setDescription] = useState(entry.description || "");
  const [tags, setTags] = useState(entry.tags?.join(", ") || "");

  const handleSave = () => {
    onSave({
      ...entry,
      description,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg p-6 w-[450px] shadow-xl"
      >
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Entry Options</h2>
        
        <motion.div
          whileHover={{ scale: 1.1, rotate: 90 }}
          transition={{ duration: 0.2 }}
          className="absolute top-4 right-4"
        >
          <FaTimes
            className="cursor-pointer text-gray-500 hover:text-gray-700"
            onClick={onClose}
          />
        </motion.div>
        
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
          className="w-full p-2 border rounded mb-4 shadow-sm"
        />
        
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Add tags (comma-separated)..."
          className="w-full p-2 border rounded mb-6 shadow-sm"
        />
        
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors mr-2"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
          >
            Save
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// New: Calendar Modal Component
interface CalendarModalProps {
  onClose: () => void;
  onDateSelect: (date: string) => void;
  entriesByDate: Record<string, Entry[]>;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  viewMode: "month" | "year";
  setViewMode: (mode: "month" | "year") => void;
}

// Define a Cell type for calendar grid
interface CalendarCell {
  day: number;
  dateStr: string;
  hasEntries: boolean;
  isToday: boolean;
}

const CalendarModal: React.FC<CalendarModalProps> = ({
  onClose,
  onDateSelect,
  entriesByDate,
  currentDate,
  setCurrentDate,
  viewMode,
  setViewMode,
}) => {
  // Helper to get days in month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Helper to generate month grid
  const generateMonthGrid = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const days = getDaysInMonth(date);
    const grid: Array<Array<CalendarCell | null>> = [];
    const today = new Date().toISOString().split("T")[0];
    let day = 1;
    for (let i = 0; i < 6; i++) { // Up to 6 weeks
      const week: Array<CalendarCell | null> = [];
      for (let j = 0; j < 7; j++) {
        if ((i === 0 && j < firstDay) || day > days) {
          week.push(null); // Empty cells
        } else {
          const currentDay = new Date(date.getFullYear(), date.getMonth(), day);
          const dateStr = currentDay.toISOString().split("T")[0];
          week.push({
            day,
            dateStr,
            hasEntries: !!entriesByDate[dateStr],
            isToday: dateStr === today
          });
          day++;
        }
      }
      grid.push(week);
    }
    return grid;
  };

  // Handlers for navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const prevYear = () => {
    setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
  };
  const nextYear = () => {
    setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
  };

  // Handle close, reset to month view when closing
  const handleClose = () => {
    setViewMode("month");
    onClose();
  };

  // Generate year view: 12 months in a 3x4 grid
  const generateYearGrid = (year: number) => {
    const months: Array<{name: string; grid: Array<Array<CalendarCell | null>>}> = [];
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(year, m, 1);
      months.push({
        name: monthDate.toLocaleString("default", { month: "long" }),
        grid: generateMonthGrid(monthDate),
      });
    }
    return months;
  };

  const monthGrid = generateMonthGrid(currentDate);
  const yearGrid = generateYearGrid(currentDate.getFullYear());

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-lg p-6 relative w-[90vw] max-w-4xl max-h-[80vh] overflow-y-auto shadow-xl"
      >
        <FaTimes
          className="absolute top-4 right-4 cursor-pointer text-gray-500 hover:text-gray-700"
          onClick={handleClose}
        />
        {viewMode === "month" ? (
          <>
            <div className="flex justify-center items-center mb-4">
              <div className="relative inline-flex items-center justify-center w-64">
                <motion.div 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.9 }}
                  className="absolute left-0 cursor-pointer"
                >
                  <FaChevronLeft 
                    className="text-gray-500 hover:text-blue-500" 
                    onClick={prevMonth}
                    size={16}
                  />
                </motion.div>
                <span
                  className="text-xl font-semibold text-center cursor-pointer hover:text-blue-500"
                  onClick={() => setViewMode("year")}
                  title="Click to view year overview"
                >
                  {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
                </span>
                <motion.div 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.9 }}
                  className="absolute right-0 cursor-pointer"
                >
                  <FaChevronRight 
                    className="text-gray-500 hover:text-blue-500" 
                    onClick={nextMonth}
                    size={16}
                  />
                </motion.div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="font-medium text-gray-600">{day}</div>
              ))}
              {monthGrid.flat().map((cell, index) => (
                <div
                  key={index}
                  className={`p-2 ${
                    cell ? "cursor-pointer" : ""
                  } ${
                    cell?.hasEntries ? "bg-blue-50 font-bold" : "text-gray-500"
                  } ${
                    cell?.isToday ? "border-2 border-blue-500 rounded-full font-bold text-blue-700" : cell ? "hover:bg-blue-100 hover:rounded-full" : ""
                  }`}
                  onClick={() => {
                    if (cell) {
                      onDateSelect(cell.dateStr);
                      onClose();
                    }
                  }}
                >
                  {cell?.day || ""}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center items-center mb-4">
              <div className="relative inline-flex items-center justify-center w-48">
                <motion.div 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.9 }}
                  className="absolute left-0 cursor-pointer"
                >
                  <FaChevronLeft 
                    className="text-gray-500 hover:text-blue-500" 
                    onClick={prevYear}
                    size={16}
                  />
                </motion.div>
                <span className="text-xl font-semibold text-center">
                  {currentDate.getFullYear()}
                </span>
                <motion.div 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.9 }}
                  className="absolute right-0 cursor-pointer"
                >
                  <FaChevronRight 
                    className="text-gray-500 hover:text-blue-500" 
                    onClick={nextYear}
                    size={16}
                  />
                </motion.div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {yearGrid.map((month, idx) => (
                <div key={idx} className="border p-2 rounded">
                  <div
                    className="text-center font-medium mb-2 cursor-pointer hover:text-blue-500"
                    onClick={() => {
                      setCurrentDate(new Date(currentDate.getFullYear(), idx, 1));
                      setViewMode("month");
                    }}
                  >
                    {month.name}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-xs text-center">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                      <div key={day} className="text-gray-600">{day}</div>
                    ))}
                    {month.grid.flat().map((cell, cellIdx) => (
                      <div
                        key={cellIdx}
                        className={`p-1 ${
                          cell ? "cursor-pointer" : ""
                        } ${
                          cell?.hasEntries ? "bg-blue-50 font-bold" : "text-gray-500"
                        } ${
                          cell?.isToday ? "border border-blue-500 rounded-full text-blue-700" : cell ? "hover:bg-blue-100 hover:rounded-full" : ""
                        }`}
                        onClick={() => {
                          if (cell) {
                            onDateSelect(cell.dateStr);
                            onClose();
                          }
                        }}
                      >
                        {cell?.day || ""}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [view, setView] = useState<"landing" | "overview">("landing");
  const [entries, setEntries] = useState<Entry[]>([
    {
      id: "1",
      title: "Sample Entry 1",
      text: "This is a sample entry for testing purposes. It demonstrates how the application handles text input and display. The text can be formatted in different ways using the shuffle feature. You can convert it to Markdown, LaTeX, JSON, or HTML formats with just a few clicks. The application also allows you to customize the text size and width of the editing area to suit your preferences.",
      date: "2023-11-01",
      description: "Test description",
      tags: ["test", "sample"],
      width: 1125,
      fontSize: 16,
    },
    {
      id: "2",
      title: "Sample Entry 2",
      text: "This is another sample entry with a different date. It showcases how the application organizes entries by date in the sidebar. You can easily navigate between different days to view all entries for that specific date. Each entry preview displays a snippet of the content, and you can click on it to edit or view the full text. The sidebar also shows you how many entries you have for each day.",
      date: "2023-11-02",
      description: "Another test",
      tags: ["example"],
      width: 1125,
      fontSize: 16,
    },
    {
      id: "3",
      title: "Sample Entry 3",
      text: "Yet another sample entry for a different date. This demonstrates the flexibility of the application in handling multiple entries across various dates. You can edit any entry by clicking on it, and you can also access additional options like adding tags or descriptions. The shuffle feature allows you to transform your plain text into other formats that you can copy and use elsewhere. The responsive design ensures that the application works well on different screen sizes.",
      date: "2023-11-03",
      description: "Third test",
      tags: ["sample", "test"],
      width: 1125,
      fontSize: 16,
    },
  ]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<Partial<Entry> | null>(null);
  const [shufflingText, setShufflingText] = useState<string | null>(null);
  const [optionsEntry, setOptionsEntry] = useState<Entry | null>(null);
  // Global notification state
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  // New: Calendar state
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<"month" | "year">("month");

  const addEntry = (entry: Entry) => setEntries([...entries, entry]);
  const updateEntry = (id: string, entry: Partial<Entry>) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, ...entry } : e)));
  };
  const deleteEntry = (id: string) =>
    setEntries(entries.filter((e) => e.id !== id));

  const handleNewEntry = () => {
    const today = new Date().toISOString().split("T")[0];
    setEditingEntry({
      id: Date.now().toString(),
      date: today,
      width: 1125, // Default width for new entries (50% larger than before)
      fontSize: 16, // Default font size
    });
    setSelectedDate(today);
  };

  // Group entries by date
  const entriesByDate = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, Entry[]>);

  // Get unique dates sorted in descending order
  const dates = Object.keys(entriesByDate).sort().reverse();

  // Get today's date and default to it if no date is selected
  const today = new Date().toISOString().split("T")[0];
  const effectiveDate = selectedDate || today;

  // Filter entries to show only those for the selected date
  const filteredEntries = entriesByDate[effectiveDate] || [];

  return (
    <AppContext.Provider
      value={{
        entries,
        addEntry,
        updateEntry,
        deleteEntry,
        setNotificationVisible,
        setCopiedFormat,
        setNotificationMessage,
      }}
    >
      <div className="min-h-screen bg-gray-50">
        <AnimatePresence>
          {view === "landing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-screen flex flex-col items-center justify-center gap-12 relative bg-gradient-to-b from-gray-50 to-gray-100"
            >
              <motion.h1
                className="text-8xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-900"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                Shuffle
              </motion.h1>

              <motion.div
                className="flex gap-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <motion.button
                  onClick={() => {
                    setView("overview");
                    handleNewEntry();
                  }}
                  className="relative py-4 px-10 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-all duration-300 shadow-lg font-medium"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Let's shuffle
                </motion.button>
                <motion.button
                  onClick={() => setView("overview")}
                  className="relative py-4 px-10 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-all duration-300 shadow-lg font-medium border border-gray-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Let's review
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {view === "overview" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-h-screen"
            >
              {/* Sidebar - Past Entries by Date */}
              <div className="relative w-64 bg-white border-r p-4 shadow-sm">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">Entries</h2>
                <AnimatePresence>
                  {dates.map((date) => (
                    <motion.div
                      key={date}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className={`p-2 cursor-pointer rounded-md mb-1 ${
                        date === effectiveDate
                          ? "bg-blue-50 border-l-4 border-blue-500"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedDate(date)}
                    >
                      <p className="font-medium">{date}</p>
                      {date === effectiveDate ? (
                        <p className="text-sm text-blue-600">
                          {entriesByDate[date].length} entries
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 truncate">
                          {entriesByDate[date][0]?.title || "Untitled"}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {/* New: Calendar icon at bottom left */}
                <motion.div
                  className="absolute bottom-4 left-4"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaRegCalendarAlt
                    className="cursor-pointer text-gray-600 hover:text-blue-500 text-2xl"
                    onClick={() => setCalendarVisible(true)}
                    title="Open calendar"
                  />
                </motion.div>
              </div>

              {/* Main Content */}
              <div className="flex-1 p-8">
                <div className="flex justify-between items-center mb-8">
                  <motion.h2
                    key={effectiveDate}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-semibold text-gray-800"
                  >
                    Entries for {effectiveDate}
                  </motion.h2>
                </div>
                <motion.div
                  key={effectiveDate}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.05 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  <AnimatePresence>
                    {filteredEntries.map((entry) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileHover={{ scale: 1.02, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}
                        transition={{ duration: 0.2 }}
                        className="relative bg-white p-5 rounded-lg shadow-sm hover:shadow-md border border-gray-100 flex flex-col h-[210px] group"
                        onClick={() => setEditingEntry(entry)}
                      >
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <FaEdit
                            className="cursor-pointer text-gray-500 hover:text-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOptionsEntry(entry);
                            }}
                            title="Edit options"
                          />
                          <FaRandom
                            className="cursor-pointer text-gray-500 hover:text-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShufflingText(entry.text);
                            }}
                            title="Transform text"
                          />
                        </div>
                        <h3 className="font-semibold truncate text-gray-800">
                          {entry.title || "Untitled"}
                        </h3>
                        {entry.description && (
                          <p className="text-sm text-gray-500 mt-1">{entry.description}</p>
                        )}
                        <p className="text-gray-600 mt-2 line-clamp-3 text-sm flex-grow overflow-hidden">
                          {entry.text}
                        </p>
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-auto pt-2">
                            {entry.tags.map((tag, index) => (
                              <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Add a "New Entry" button with dotted outline */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05, borderColor: "#3b82f6" }}
                    className="bg-white p-5 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-md h-[210px]"
                    onClick={handleNewEntry}
                  >
                    <FaPlus className="text-2xl text-gray-400 hover:text-blue-500" />
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <AnimatePresence>
          {editingEntry && (
            <EditModal
              entry={editingEntry}
              onClose={() => setEditingEntry(null)}
              onSave={(entry) => {
                const today = new Date().toISOString().split("T")[0];
                if (entry.id && entries.find((e) => e.id === entry.id)) {
                  updateEntry(entry.id, entry);
                } else {
                  addEntry({
                    ...entry,
                    date: entry.date || today,
                    width: entry.width || 1125, // Ensure width is saved with larger default
                    fontSize: entry.fontSize || 16, // Ensure font size is saved
                  } as Entry);
                }
                setEditingEntry(null);
              }}
            />
          )}
          {shufflingText && (
            <ShuffleModal
              text={shufflingText}
              onClose={() => setShufflingText(null)}
            />
          )}
          {optionsEntry && (
            <OptionsModal
              entry={optionsEntry}
              onClose={() => setOptionsEntry(null)}
              onSave={(entry) => {
                updateEntry(optionsEntry.id, entry);
                setOptionsEntry(null);
              }}
            />
          )}
          {/* New: Render CalendarModal */}
          {calendarVisible && (
            <CalendarModal
              onClose={() => setCalendarVisible(false)}
              onDateSelect={(date) => {
                setSelectedDate(date);
                setCalendarVisible(false);
              }}
              entriesByDate={entriesByDate}
              currentDate={calendarDate}
              setCurrentDate={setCalendarDate}
              viewMode={calendarViewMode}
              setViewMode={setCalendarViewMode}
            />
          )}
        </AnimatePresence>

        {/* Global notification */}
        <AnimatePresence>
          {notificationVisible && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center"
            >
              <FaCheck className="mr-2" />
              {notificationMessage || `${copiedFormat} text copied to clipboard!`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
};

export default App;
