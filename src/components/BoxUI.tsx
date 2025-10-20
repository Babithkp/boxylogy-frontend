import { useEffect, useState, useRef } from "react";
import {
  MdOutlineKeyboardArrowUp,
  MdOutlineKeyboardArrowDown,
  MdDelete 
} from "react-icons/md";
import { IoMdDownload } from "react-icons/io";
import { FaDownload } from "react-icons/fa6";
import ThreeJsStaticOptimized from "./ThreeJsStaticOptimized";
import Background from '../assets/Background.png';
import Box from '../assets/Box.png';
import RightSideBar from '../assets/RightSideBar.png';
import LeftSideBar from '../assets/LeftSideBar.png';
import TrikonaLogo from '../assets/TrikonaLogo.png';
import { toast } from "sonner";

interface BoxDimensions {
  length: string;
  width: string;
  height: string;
  weight: string;
  quantity: string;
  rotation: boolean;
  collapsed: boolean;
  unit: string;
  boxName?: string;
}

interface ContainerDimensions {
  length: string;
  width: string;
  height: string;
  maxCapacity?: string;
  fit?: string;
  unit: string;
}

interface PackedItemData {
  name: string;
  position: unknown;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
}

interface PackResult {
  container_name: string;
  utilization: string;
  container_dimensions: {
    length: number;
    width: number;
    height: number;
  };
  packed_items_data: PackedItemData[];
}

const defaultBoxes = [
  { box: "20 ft Standard", length: 5.9, width: 2.35, height: 2.39 },
  { box: "40 ft Standard", length: 12.03, width: 2.35, height: 2.39 },
  { box: "40 ft High Cube", length: 12.19, width: 2.35, height: 2.69 },
  { box: "20 ft Reefer", length: 5.9, width: 2.35, height: 2.39 },
  { box: "40 ft Reefer", length: 12.03, width: 2.35, height: 2.39 },
  { box: "32 ft Container", length: 9.75, width: 2.35, height: 2.39 },
];

// const API_BASE = import.meta.env.VITE_DEV;

function BoxUI() {
  const threeRef = useRef<{ exportPNG: () => void } | null>(null);
  const [boxDimensions, setBoxDimensions] = useState<BoxDimensions[]>([
    {
      length: "",
      width: "",
      height: "",
      weight: "",
      quantity: "1",
      rotation: false,
      collapsed: false,
      unit: "m",
      boxName: "Box 1",
    },
  ]);

  const [containerDimensions, setContainerDimensions] =
    useState<ContainerDimensions>({
      length: "",
      width: "",
      height: "",
      maxCapacity: "",
      fit: "best_fit",
      unit: "m",
    });

  const [packedItems, setPackedItems] = useState<PackedItemData[] | null>(null);

  const [containerVolume, setContainerVolume] = useState<number>(0);
  const [leftSideBar, setLeftSideBar] = useState(() => window.innerWidth >= 768);
  const [rightSideBar, setRightSideBar] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setLeftSideBar(true);
        setRightSideBar(true);
      } else {
        setLeftSideBar(false);
        setRightSideBar(false);
      }
    };
    handleChange(mq);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);
  


  const [totalBoxVolume, setTotalBoxVolume] = useState<number>(0);
  const [totalBoxWeight, setTotalBoxWeight] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PackResult[] | null>(null);
  const [numContainers, setNumContainers] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleLeftSidebar = () =>
    setLeftSideBar((prev) => {
      const next = !prev;
      if (next) setRightSideBar(false);
      return next;
    });

  const toggleRightSidebar = () =>
    setRightSideBar((prev) => {
      const next = !prev;
      if (next) setLeftSideBar(false);
      return next;
    });

  const addBox = () => {
    setBoxDimensions((prev) => [
      ...prev,
      {
        length: "",
        width: "",
        height: "",
        weight: "",
        quantity: "1",
        rotation: false,
        collapsed: false,
        unit: "m",
        boxName: `Box ${prev.length + 1}`,
      },
    ]);
  };

  const toggleCollapse = (index: number) => {
    setBoxDimensions((prev) =>
      prev.map((box, i) =>
        i === index ? { ...box, collapsed: !box.collapsed } : box
      )
    );
  };

  const convertToMeters = (value: number, unit: string): number => {
    switch (unit) {
      case "ft":
        return value * 0.3048;
      case "cm":
        return value / 100;
      case "mm":
        return value / 1000;
      case "in":
        return value * 0.0254;
      case "m":
      default:
        return value;
    }
  };

  const updateBoxField = (
    index: number,
    field: keyof BoxDimensions,
    value: string | boolean
  ) => {
    setBoxDimensions((prev) =>
      prev.map((box, i) => (i === index ? { ...box, [field]: value } : box))
    );
  };

  const updateContainerField = (
    field: keyof ContainerDimensions,
    value: string
  ) => {
    setContainerDimensions((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const length = convertToMeters(
      Number(containerDimensions.length || 0),
      containerDimensions.unit
    );
    const width = convertToMeters(
      Number(containerDimensions.width || 0),
      containerDimensions.unit
    );
    const height = convertToMeters(
      Number(containerDimensions.height || 0),
      containerDimensions.unit
    );

    const containerVol = length * width * height;
    setContainerVolume(Number(containerVol.toFixed(2)));
  }, [
    containerDimensions.length,
    containerDimensions.width,
    containerDimensions.height,
    containerDimensions.unit,
  ]);

  useEffect(() => {
    let totalVolume = 0;
    let totalWeight = 0;

    // compute volumes & weights (we keep totals used in UI)
    boxDimensions.forEach((box) => {
      const length = convertToMeters(Number(box.length || 0), box.unit);
      const width = convertToMeters(Number(box.width || 0), box.unit);
      const height = convertToMeters(Number(box.height || 0), box.unit);
      const perPieceVolume = length * width * height;
      const qty = Number(box.quantity) || 1;
      const boxVolume = perPieceVolume * qty;
      const boxWeight = (Number(box.weight) || 0) * qty;
      totalVolume += isNaN(boxVolume) ? 0 : boxVolume;
      totalWeight += boxWeight;
    });

    setTotalBoxVolume(Number(totalVolume.toFixed(3)));
    setTotalBoxWeight(Number(totalWeight.toFixed(3)));
  }, [boxDimensions]);

  const setValuesInContainer = (dimension: {
    length: number;
    width: number;
    height: number;
  }) => {
    setContainerDimensions((prev) => ({
      ...prev,
      length: dimension.length.toString(),
      width: dimension.width.toString(),
      height: dimension.height.toString(),
      unit: "m",
    }));
  };

  const handlePlan = async () => {
    setLoading(true);
    setErrorMessage(null);
    setResults(null);
    setNumContainers(null);
    setPackedItems(null);

    try {
      const maxCapNum = Number(containerDimensions.maxCapacity || 0);
      if (containerDimensions.maxCapacity && !isNaN(maxCapNum) && maxCapNum < totalBoxWeight) {
        toast.error("Container capacity is less than total box weight. Please adjust container capacity or box weights.");
        setLoading(false);
        return;
      }

      const payload = {
        container_length: Number(containerDimensions.length || 0),
        container_width: Number(containerDimensions.width || 0),
        container_height: Number(containerDimensions.height || 0),
        bigger_first: containerDimensions.fit === "BiggerFirst" || false,
        distribute_items: false,
        rotation: false,
        packing_strategy:
          containerDimensions.fit === "BiggerFirst" ? "best_fit" : "best_fit",
        verbose: false,
        box_name: boxDimensions.map((b) => b.boxName || "Box"),
        box_length: boxDimensions.map((b) => Number(b.length || 0)),
        box_width: boxDimensions.map((b) => Number(b.width || 0)),
        box_height: boxDimensions.map((b) => Number(b.height || 0)),
        box_weight: boxDimensions.map((b) => Number(b.weight || 0)),
        box_quantity: boxDimensions.map((b) => Number(b.quantity || 1)),
      };

      const res = await fetch(`https://boxlogic-backend.coolify.trikonatech.com/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.error || `Server error: ${res.statusText}`;
        setErrorMessage(msg);
        setLoading(false);
        toast.error("Calculation failed. Please try again.");
        return;
      }

      const json = await res.json();

      setResults(json.results || []);
      toast.success("Calculation completed successfully.");
      setNumContainers(json.num_containers || 0);

      if (json.results && json.results.length > 0) {
        const first = json.results[0];
        setPackedItems(first.packed_items_data || []);
        if (first.container_dimensions) {
          setContainerDimensions((prev) => ({
            ...prev,
            length: String(first.container_dimensions.length || prev.length),
            width: String(first.container_dimensions.width || prev.width),
            height: String(first.container_dimensions.height || prev.height),
            unit: "m",
          }));
        }
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const deleteBox = (index: number) => {
    setBoxDimensions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-screen w-full relative text-black overflow-x-hidden overflow-y-hidden">
      {/* Navbar */}
      <div className="flex justify-between items-center md:hidden w-full relative top-0 left-0 bg-white py-5 px-5 z-50">
        <h1 className="text-2xl font-semibold">📦BoxLogic</h1>
        <button
          className="border border-gray-300 hover:bg-gray-100 cursor-pointer px-3 py-3 rounded-md flex items-center" onClick={() => threeRef.current?.exportPNG?.()}>
          <IoMdDownload />
        </button>
      </div>

      <div
        className={`sidebar ${
          leftSideBar ? "translate-x-0" : "-translate-x-full"
        } w-76 md:w-64 transition-all duration-300 ease-in bg-white h-screen z-20 py-5 overflow-y-auto absolute top-0 left-0 border-r border-gray-300 mt-10 md:mt-0`}
      >
        <h1 className="hidden md:block text-2xl font-bold px-5">📦BoxLogic</h1>

        <div className="flex justify-between items-center mt-5 px-5">
          <p className="text-[15px] font-semibold">Box Dimensions</p>
          <button
            onClick={addBox}
            className="text-2xl h-10 w-10 flex justify-center items-center rounded-full hover:bg-gray-100 cursor-pointer text-black"
          >
            +
          </button>
        </div>

        <div className="mt-3 mb-10 px-5">
          {boxDimensions.map((box, index) => (
            <div key={index} className="rounded-md py-1 bg-white mb-2">
              <div className="flex justify-between items-center px-1">
                <p className="font-medium">{box.boxName || `BOX ${index + 1}`}</p>
                <p className="text-[12px] text-gray-400 px-2">
                  {box.length || "L"} x {box.width || "W"} x {box.height || "H"}{" "}
                  {box.unit}
                </p>
                {box.collapsed ? (
                  <MdOutlineKeyboardArrowDown
                  className="text-2xl cursor-pointer"
                  onClick={() => toggleCollapse(index)}
                  />
                ) : (
                  <MdOutlineKeyboardArrowUp
                  className="text-2xl cursor-pointer"
                  onClick={() => toggleCollapse(index)}
                  />
                )}
                <MdDelete className="text-red-400 text-2xl cursor-pointer rounded-full p-1 hover:bg-gray-100" onClick={() => deleteBox(index)}/>
              </div>

              {/* Collapsible Content */}
              {!box.collapsed && (
                <div className="mt-3 space-y-3 transition-all duration-300 ease-in-out px-1">
                  {/* Name */}
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                    value={box.boxName}
                    onChange={(e) => updateBoxField(index, "boxName", e.target.value)}
                  />

                  {/* Length */}
                  <div className="flex border border-gray-300 rounded-md px-2 py-1 text-sm">
                    <input
                      type="number"
                      placeholder="L*"
                      className="outline-none w-full"
                      value={box.length}
                      onChange={(e) => updateBoxField(index, "length", e.target.value)}
                    />
                    <select
                      className="ml-2 outline-none"
                      value={box.unit}
                      onChange={(e) => updateBoxField(index, "unit", e.target.value)}
                    >
                      <option value="m">m</option>
                      <option value="ft">ft</option>
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                      <option value="in">in</option>
                    </select>
                  </div>

                  {/* Width */}
                  <div className="flex border border-gray-300 rounded-md px-2 py-1 text-sm">
                    <input
                      type="number"
                      placeholder="W*"
                      className="outline-none w-full"
                      value={box.width}
                      onChange={(e) => updateBoxField(index, "width", e.target.value)}
                    />
                    <select
                      className="ml-2 outline-none"
                      value={box.unit}
                      onChange={(e) => updateBoxField(index, "unit", e.target.value)}
                    >
                      <option value="m">m</option>
                      <option value="ft">ft</option>
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                      <option value="in">in</option>
                    </select>
                  </div>

                  {/* Height */}
                  <div className="flex border border-gray-300 rounded-md px-2 py-1 text-sm">
                    <input
                      type="number"
                      placeholder="H*"
                      className="outline-none w-full"
                      value={box.height}
                      onChange={(e) => updateBoxField(index, "height", e.target.value)}
                    />
                    <select
                      className="ml-2 outline-none"
                      value={box.unit}
                      onChange={(e) => updateBoxField(index, "unit", e.target.value)}
                    >
                      <option value="m">m</option>
                      <option value="ft">ft</option>
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                      <option value="in">in</option>
                    </select>
                  </div>

                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                    value={box.weight}
                    onChange={(e) => updateBoxField(index, "weight", e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Quantity"
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                    value={box.quantity}
                    onChange={(e) => updateBoxField(index, "quantity", e.target.value)}
                  />
                  <label className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={box.rotation}
                      onChange={(e) => updateBoxField(index, "rotation", e.target.checked)}
                    />
                    Enable Rotation
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="py-2 w-full px-5 sticky -bottom-5 bg-white">
          <button
            onClick={handlePlan}
            className="bg-blue-400 hover:bg-blue-500 text-white cursor-pointer py-2 w-full rounded-md"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-1">
                <div className="w-7 h-7 rounded-full border-r-2 animate-spin"></div>
                <div>Calculating...</div>
              </div>
            ) : "Update"}
          </button>
        </div>
      </div>

      {/* Middle Section */}
      <div
        className={`relative h-screen transition-all duration-300 ease-in-out ${
          leftSideBar ? "md:ml-64" : "ml-0"
        } ${rightSideBar ? "md:mr-64" : "mr-0"}`}
      >
        {/* LEFT floating handle (mobile) - now uses toggleLeftSidebar */}
        <button
          className={`absolute z-10 top-[50%] left-0 -translate-y-[50%] w-10 h-40 transition-all duration-300 ease-in md:hidden ${
            leftSideBar ? "translate-x-76 md:translate-x-64" : "translate-x-0"
          }`}
          onClick={toggleLeftSidebar}
        >
          <img src={LeftSideBar} alt="" className="w-[75%] object-contain" />
        </button>

        {/* RIGHT floating handle (mobile) - now uses toggleRightSidebar */}
        <button
          className={`absolute z-50 top-[30%] -translate-y-[50%] w-10 h-40 transition-all duration-300 ease-in md:hidden ${
            rightSideBar ? "right-74" : "-right-2"
          }`}
          onClick={toggleRightSidebar}
        >
          <img src={RightSideBar} alt="" className="w-full h-full object-contain" />
        </button>

        <div className="w-full h-full">
          <img
            src={Background}
            alt="background"
            className="w-full h-full object-cover bg-white absolute top-0 left-0"
          />
          {/* Top stats */}
          <div className="w-full md:w-[65%] mx-0 absolute py-7 flex flex-col gap-3 text-white font-semibold p-3 rounded-md">
            <div className="flex overflow-x-auto sidebar w-full">
              {boxDimensions.map((box, i) => (
                <div key={i} className="text-black flex-shrink-0 flex flex-col items-center text-xl px-3">
                  <p className="text-[11px] md:text-[13px]">
                    Total:{" "}
                    {(
                      Number(box.length || 0) *
                      Number(box.width || 0) *
                      Number(box.height || 0) *
                      (Number(box.quantity || 1))
                    ).toFixed(2)}{" "}
                    {box.unit}
                  </p>
                  <img src={Box} alt="box" className="w-[40%] object-contain" />
                  <p className="text-[11px] md:text-[13px]">
                    Weight: {(Number(box.weight || 0) * Number(box.quantity || 1)).toFixed(2)} kg
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:min-w-56 md:max-h-30 bg-white border-2 flex flex-col border-gray-300 rounded-md absolute bottom-25 left-5 right-5 md:top-5 md:right-5 md:left-auto md:px-3 px-4 py-3 md:py-3 text-[14px] justify-center gap-2 font-semibold overflow-auto sidebar">
            <p>Containers Required: {numContainers}</p>
            <p>Container Volume: {containerVolume} m³</p>
            <p>Total Boxes Volume: {totalBoxVolume} m³</p>
            <p>Total Boxes Weight: {totalBoxWeight} kg</p>
          </div>

          <div className="w-full top-[30%] md:top-[45%] absolute -translate-y-[30%] h-[500px]">
            <ThreeJsStaticOptimized
              ref={threeRef}
              containerDimensions={containerDimensions}
              boxDimensions={boxDimensions}
              maxInstances={3500}
              style={{ height: 500 }}
              packedItemsData={packedItems ?? undefined} // <- PASS API result here
              showGrid
            />
          </div>
        </div>
      </div>

      {/* Right Sidebar*/}
      <div
        className={`sidebar ${
          rightSideBar ? "translate-x-0" : "translate-x-full"
        } w-76 md:w-64 transition-all duration-300 ease-in bg-white h-screen z-20 py-1 px-3 overflow-auto absolute top-0 right-0 border-l border-gray-300 mt-15 md:mt-0`}
      >

        {/* Add the Export PNG button near the top of right sidebar */}
        <div className="flex justify-end mt-2 px-1">
          <button
            onClick={() => threeRef.current?.exportPNG?.()}
            className="hidden md:flex items-center justify-center gap-2 border-2 border-blue-400 hover:bg-blue-400 hover:text-white cursor-pointer transition-all duration-300 text-black px-3 py-1 rounded-md font-semibold"
          >
            <FaDownload />
            Export
          </button>
        </div>
        
        {/* Results area */}
        <div className="pointer-events-auto">
          <div className="bg-white rounded-md p-3 max-h-30 overflow-auto sidebar">
            {/* <div className="flex justify-center items-center mb-2">
              <button
                className="border border-gray-300 hover:bg-gray-100 cursor-pointer px-3 py-1 rounded-md md:flex items-center gap-2 hidden w-full justify-center"
                onClick={() => {
                  if (!results) return;
                  const blob = new Blob(
                    [JSON.stringify({ results, numContainers }, null, 2)],
                    {
                      type: "application/json",
                    }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "packing-results.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <IoMdDownload />
                Export Results
              </button>
            </div> */}

            {loading && <p>Planning containers... (this may take a moment)</p>}
            {errorMessage && <div className="text-red-600 font-medium">{errorMessage}</div>}
            {!loading && !results && !errorMessage && <div className="text-sm text-gray-500">No results yet. Click Update.</div>}
          </div>
        </div>

        <div className="py-2">
          <h1 className="text-md font-semibold">Container Dimensions</h1>
          <div className="flex flex-col justify-between items-center mt-2 gap-3">
            <div className="flex bg-white w-full border border-gray-300 rounded-md px-2 py-1 text-sm">
              <input
                type="number"
                placeholder="L*"
                className="outline-none w-full"
                value={containerDimensions.length}
                onChange={(e) =>
                  updateContainerField("length", e.target.value)
                }
              />
              <select
                className="ml-3 outline-none"
                value={containerDimensions.unit}
                onChange={(e) => updateContainerField("unit", e.target.value)}
              >
                <option value="m">m</option>
                <option value="ft">ft</option>
                <option value="cm">cm</option>
                <option value="mm">mm</option>
                <option value="in">in</option>
              </select>
            </div>

            <div className="flex bg-white w-full border border-gray-300 rounded-md px-2 py-1 text-sm">
              <input
                type="number"
                placeholder="W*"
                className="outline-none w-full"
                value={containerDimensions.width}
                onChange={(e) =>
                  updateContainerField("width", e.target.value)
                }
              />
              <select
                className="ml-3 outline-none"
                value={containerDimensions.unit}
                onChange={(e) => updateContainerField("unit", e.target.value)}
              >
                <option value="m">m</option>
                <option value="ft">ft</option>
                <option value="cm">cm</option>
                <option value="mm">mm</option>
                <option value="in">in</option>
              </select>
            </div>

            <div className="flex bg-white w-full border border-gray-300 rounded-md px-2 py-1 text-sm">
              <input
                type="number"
                placeholder="H*"
                className="outline-none w-full"
                value={containerDimensions.height}
                onChange={(e) =>
                  updateContainerField("height", e.target.value)
                }
              />
              <select
                className="ml-3 outline-none"
                value={containerDimensions.unit}
                onChange={(e) => updateContainerField("unit", e.target.value)}
              >
                <option value="m">m</option>
                <option value="ft">ft</option>
                <option value="cm">cm</option>
                <option value="mm">mm</option>
                <option value="in">in</option>
              </select>
            </div>

            <input
              type="number"
              placeholder="Max Capacity"
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              value={containerDimensions.maxCapacity}
              onChange={(e) =>
                updateContainerField("maxCapacity", e.target.value)
              }
            />

            <select
              name="fit"
              id="fit"
              value={containerDimensions.fit}
              onChange={(e) => updateContainerField("fit", e.target.value)}
              className="w-full py-1 outline-none border border-gray-300 rounded-md px-1"
            >
              <option value="best_fit">Best Fit</option>
              <option value="BiggerFirst">Bigger First</option>
            </select>

            <button
              onClick={handlePlan}
              className="bg-blue-400 hover:bg-blue-500 text-white cursor-pointer w-full py-2 rounded-md"
            >
              {loading ?
                <div className="flex items-center justify-center gap-1">
                  <div className="w-7 h-7 rounded-full border-r-2 animate-spin"></div>
                  <div>Calculating...</div>
                </div>
                : 
                "Update"
              }
            </button>
          </div>
        </div>

        <div className="mt-2">
          <h1 className="font-semibold text-md">Standard Dimensions (meters)</h1>
          <div className="py-3">
            {defaultBoxes.map((dimension, index) => (
              <div
                key={index}
                className="flex justify-between items-center text-sm mt-1 hover:bg-gray-100 py-1 rounded-md px-2 cursor-pointer"
                onClick={() =>
                  setValuesInContainer({
                    length: dimension.length,
                    width: dimension.width,
                    height: dimension.height,
                  })
                }
              >
                <p className="text-[14px]">{dimension.box}</p>
                <p className="text-[14px]">
                  {dimension.length}×{dimension.width}×{dimension.height}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="flex items-center justify-center font-semibold w-full absolute bottom-16 left-[50%] translate-x-[-50%] md:static md:translate-x-0 md:bottom-0 md:left-auto">
          <p>Made with ❤️ by</p>
          <img src={TrikonaLogo} alt="Trikona Logo" className="w-18 object-contain" />
        </div>
      </div>
    </div>
  );
}

export default BoxUI;
