/**
 * Shop.tsx — Shared static environment for all workshop scenes.
 *
 * Renders the complete Hamester Hall environment that every scene shares:
 *   • Lighting rig (task spot + fluorescents + ambient)
 *   • Hall shell (brick walls, concrete floor, black ducted ceiling, sign)
 *   • Back-wall Casework (cabinets, shelving, blanks)
 *   • Furniture (tool cabinet, workbench, blank rack, safety gear)
 *   • DemoStation (monitor on right wall)
 *   • DemoBench (instructor demo stand, centre aisle)
 *   • StockCubbies (wood offcut pigeonhole shelving, right wall)
 *   • GrinderStation (bench grinder on pedestal, left wall)
 *
 * What is NOT included here:
 *   • The player's interactive <Lathe> — each scene adds its own.
 *   • FPSCamera / PerspectiveCamera — each scene owns its camera.
 *   • ToolRack, ToolBench, TurningScene — scene-specific interactives.
 *
 * All geometry is static and has zero per-frame allocations.
 * Materials live at module scope in their respective component files.
 */

import { Lighting, Furniture, HallLathes, DemoBench, StockCubbies, GrinderStation, ShopClutter, Doorways, TurnedDisplay, ToolWall, DustCollection, ClassroomSignage, CeilingEquipment, ShopFurniture, ShopMachines, WallConduit, SpeakerDisplay } from '../workshop/index.js';
import { Hall } from '../workshop/Hall.js';

export function Shop() {
  return (
    <group name="shop">
      {/* Lighting rig — task spot + fluorescents */}
      <Lighting />

      {/* Hall shell — floor, brick walls, ceiling, ducts, sign */}
      <Hall />

      {/* Workshop furniture — cabinets, workbench, blank rack, safety gear,
          casework (built-in back-wall run), and demo monitor */}
      <Furniture />

      {/* Prop lathes filling the hall + anti-fatigue mat at the player's lathe */}
      <HallLathes />

      {/* Instructor demo stand — centre aisle, camera arm + TV overhead */}
      <DemoBench />

      {/* Wood stock cubbies — pigeonhole shelving packed with offcuts, right wall */}
      <StockCubbies />

      {/* Bench grinder station — pedestal grinder with two wheels, left wall */}
      <GrinderStation />

      {/* Lived-in character clutter — clock, toolboxes, offcuts, bin */}
      <ShopClutter />

      {/* Walk-through double-door openings at both ends of the hall */}
      <Doorways />

      {/* Turned-work gallery shelf — finished bowls, vase, platter, spindles, eggs */}
      <TurnedDisplay />

      {/* Pegboard tool wall — hung turning gouges, skew, scraper, calipers */}
      <ToolWall />

      {/* Dust collection — corner collector, overhead duct trunk, drops + gates */}
      <DustCollection />

      {/* Classroom signage — rolling whiteboard near demo bench + wall safety posters */}
      <ClassroomSignage />

      {/* Ceiling equipment — hanging air filtration units + suspended unit heater */}
      <CeilingEquipment />

      {/* Shop-floor furniture — rolling utility cart + student watching stools */}
      <ShopFurniture />

      {/* Standalone machines — band saw, drill press, pedestal fan (entrance end) */}
      <ShopMachines />

      {/* Surface EMT electrical conduit — drops + runs + boxes on the long walls */}
      <WallConduit />

      {/* Director's handmade hi-fi speakers — shelf of cabinets, towers, poster, sub */}
      <SpeakerDisplay />
    </group>
  );
}
