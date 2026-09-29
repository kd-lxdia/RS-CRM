// =============================================================================
// Panel Placement Engine — Fill Face, Add Table, Sub-Array Zone
// =============================================================================

import type { Point2D, DesignModule, Orientation } from '../store/types';
import { uid, pointInPolygon, rectFullyInPolygon, rectOverlapsPolygon, insetPolygon, rotatePoint, boundingBox } from '../utils/geometry';
import { shadowFreeRowSpacing } from '../utils/geometry';
import RBush from 'rbush';

export interface PlacementInput {
  roofPolygon: Point2D[];          // in px coordinates
  obstructions: Point2D[][];       // obstruction polygons in px
  moduleWidthPx: number;
  moduleHeightPx: number;
  orientation: Orientation;
  tiltDeg: number;
  azimuthDeg: number;
  rowSpacingPx: number;
  colSpacingPx: number;            // gap between modules in same row
  tableRows: number;
  tableCols: number;
  tableSpacingPx: number;          // gap between tables
  setbackPx: number;
  obstructionBufferPx: number;
}

export interface PlacementResult {
  modules: DesignModule[];
  count: number;
}

const DEG = Math.PI / 180;

export function runPlacement(input: PlacementInput): PlacementResult {
  const {
    roofPolygon,
    obstructions,
    tiltDeg,
    azimuthDeg,
    setbackPx,
    obstructionBufferPx,
  } = input;

  let { moduleWidthPx, moduleHeightPx } = input;

  // Swap for landscape
  if (input.orientation === 'landscape') {
    [moduleWidthPx, moduleHeightPx] = [moduleHeightPx, moduleWidthPx];
  }

  // Step 1: Inset polygon for setback
  const insetPoly = insetPolygon(roofPolygon, setbackPx);
  if (insetPoly.length < 3) return { modules: [], count: 0 };

  // Step 2: Buffer obstructions
  const bufferedObs = obstructions.map(obs => {
    // Simple: expand each vertex outward from centroid
    const cx = obs.reduce((s, p) => s + p.x, 0) / obs.length;
    const cy = obs.reduce((s, p) => s + p.y, 0) / obs.length;
    return obs.map(p => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy);
      if (len < 1) return { x: p.x + obstructionBufferPx, y: p.y + obstructionBufferPx };
      return {
        x: p.x + (dx / len) * obstructionBufferPx,
        y: p.y + (dy / len) * obstructionBufferPx,
      };
    });
  });

  // Step 3: Rotate coordinate system to align with azimuth
  const rotAngle = -(azimuthDeg - 180) * DEG;
  const rotatedPoly = insetPoly.map(p => rotatePoint(p, rotAngle));
  const rotatedObs = bufferedObs.map(obs => obs.map(p => rotatePoint(p, rotAngle)));

  // Step 4: Spatial index for obstructions (RBush)
  const tree = new RBush();
  const obsItems = rotatedObs.map((obs, i) => {
    const box = boundingBox(obs);
    return { minX: box.minX, minY: box.minY, maxX: box.maxX, maxY: box.maxY, index: i };
  });
  tree.load(obsItems);

  // Step 5: Bounding box of roof
  const bb = boundingBox(rotatedPoly);

  // Step 6: Row spacing
  const rowSpacing = input.rowSpacingPx;
  const colSpacing = moduleWidthPx + input.colSpacingPx;

  // Step 6: Table dimensions
  const tableW = input.tableCols * colSpacing;
  const tableH = input.tableRows * (moduleHeightPx + input.colSpacingPx);

  // Step 7: Grid fill with tables
  const modules: DesignModule[] = [];
  const hw = moduleWidthPx / 2;
  const hh = moduleHeightPx / 2;

  let tableRow = 0;
  for (let ty = bb.minY + hh; ty + tableH <= bb.maxY + hh; ty += tableH + input.tableSpacingPx + rowSpacing) {
    let tableCol = 0;
    for (let tx = bb.minX + hw; tx + tableW <= bb.maxX + hw; tx += tableW + input.tableSpacingPx) {
      // Place individual modules within this table
      for (let r = 0; r < input.tableRows; r++) {
        for (let c = 0; c < input.tableCols; c++) {
          const cx = tx + c * colSpacing;
          const cy = ty + r * (moduleHeightPx + input.colSpacingPx);

          // Check module fits inside roof (in rotated frame)
          if (!rectFullyInPolygon(cx, cy, hw, hh, rotatedPoly)) continue;

          // Spatial search for nearby obstructions
          const searchBox = {
            minX: cx - hw,
            minY: cy - hh,
            maxX: cx + hw,
            maxY: cy + hh
          };
          
          const nearbyObs = tree.search(searchBox);
          
          // Precise polygon overlap check only for nearby obstructions
          const blocked = nearbyObs.some((item: any) => 
            rectOverlapsPolygon(cx, cy, hw, hh, rotatedObs[item.index])
          );
          
          if (blocked) continue;

          // Rotate back to original frame
          const orig = rotatePoint({ x: cx, y: cy }, -rotAngle);

          modules.push({
            id: uid(),
            subArrayId: '', // set by caller
            x: orig.x,
            y: orig.y,
            row: tableRow * input.tableRows + r,
            col: tableCol * input.tableCols + c,
          });
        }
      }
      tableCol++;
    }
    tableRow++;
  }

  return { modules, count: modules.length };
}

/** Compute auto row spacing in pixels */
export function autoRowSpacingPx(moduleLengthM: number, tiltDeg: number, latDeg: number, pxPerMeter: number): number {
  const spacingM = shadowFreeRowSpacing(moduleLengthM, tiltDeg, latDeg);
  return spacingM * pxPerMeter;
}
