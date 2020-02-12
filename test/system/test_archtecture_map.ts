// System Test for Architecture Map Web.

import { prepareWebDriver, releaseWebDriver } from "./web_driver_loader";
import { WebDriver, ThenableWebDriver, By, WebElement, Condition, Key } from "selenium-webdriver";
import { describe, before, after, it } from "mocha";
import { assert } from "chai";
import * as fs from "fs";

import { TestDef } from "../TestDef";

import { Def, ColorSet } from "../../src/architecture-map/javascript/Def";

// ARGs. ([0] == "node", [1] == mocha, [2] == file name)
const IS_HEADLESS = process.argv.some( (arg) => {
  return arg == "--headless";
} );

// Target .html generated by npm run build.
const TARGET_URL = "http://localhost:8080/architecture_map.html";

const DEFAULT_X = 100;
const DEFAULT_Y = 200;
const DEFAULT_W = 120;
const DEFAULT_H = 120;
const MIN_SIZE_PIX = 16;
const DRAG_DIFF = 10;
const SNAP_DRAG_DIFF = Def.SNAP_STEP_PIX + 1;
const LABEL = "ArchMod";
const DEFAULT_OUT_FRAME_W = 640;
const DEFAULT_OUT_FRAME_H = 640;
const DEFAULT_OUT_FRAME_STROKE_WIDTH = 4;



//// E2E SYSTEM TEST /////////////////////////////////////////////////////////////////////////////

describe("Test Architecture Map Web SPA Interaction", () => {
  let driver: ThenableWebDriver;
  let svg: WebElement;
  let html: WebElement;

  //// TEST LIFE-CYCLE ///////////////////////////////////////////////////////////////////////////

  before( async () => {
    driver = prepareWebDriver(IS_HEADLESS);
  } );

  beforeEach( async () => {
    cleanDownloadPath();

    await driver.get(TARGET_URL);

    svg = await driver.findElement(By.id("svg_root"));
    html = await driver.findElement(By.id("html_root"));

  } );

  afterEach( async () => {
    // NOP.
  } );

  after( async () => {
    cleanDownloadPath();
    releaseWebDriver(driver);
  } );

  /////////////////////////////////////////////////////////////////////////// TEST LIFE-CYCLE ////

  //// TEST CASE /////////////////////////////////////////////////////////////////////////////////

  it("Get Root", async () => {
    let title = await driver.getTitle();
    assert.equal(title, "Architecture Map");

    assert.isNotNull(svg);
    assert.isNotNull(html);

    let outFrame = await svg.findElement(By.id("out_frame"));
    assert.isNotNull(outFrame);

  } );

  it("Change Global Mode", async () => {
    // Elements.
    let ui = driver.findElement(By.id("god_mode_ui"));

    // Default = GOD.
    let label = await driver.findElement(By.id("global_mode_label"));
    let mode = await label.getText();
    assert.equal(mode, "GOD");
    assert.isTrue(await ui.isDisplayed());

    // Change to ITX.
    await changeToItxMode();
    assert.isFalse(await ui.isDisplayed());

    // Change to GOD.
    await changeToGodMode();
    assert.isTrue(await ui.isDisplayed());

  } );

  it("Edit OutFrame", async () => {
    let outFrame = await driver.findElement(By.id("out_frame"));
    let path = await outFrame.findElement(By.tagName("path"));
    let gripId = "grip_right_bottom";

    // Check ITX mode.
    await changeToItxMode();
    await selectOutFrame();
    assert.isEmpty(await driver.findElements(By.id(gripId)));

    // Check GOD mode.
    await changeToGodMode();
    await selectOutFrame();
    let grip = await driver.findElement(By.id(gripId));
    assert.isNotNull(grip);

    let x = DEFAULT_OUT_FRAME_STROKE_WIDTH / 2;
    let y = DEFAULT_OUT_FRAME_STROKE_WIDTH / 2;
    let w = DEFAULT_OUT_FRAME_W - DEFAULT_OUT_FRAME_STROKE_WIDTH;
    let h = DEFAULT_OUT_FRAME_H - DEFAULT_OUT_FRAME_STROKE_WIDTH;
    let d;
    let expD = (): string => {
      return `M${x},${y}L${x + w},${y}L${x + w},${y + h}L${x},${y + h}L${x},${y}`;
    };

    d = await path.getAttribute("d");
    assert.equal(d, expD());

    // Check size change.
    await drag(grip, DRAG_DIFF, DRAG_DIFF);

    w += DRAG_DIFF;
    h += DRAG_DIFF;

    d = await path.getAttribute("d");
    assert.equal(d, expD());

    // Cancel edit.
    await deselectOutFrame();
    assert.isEmpty(await driver.findElements(By.id(gripId)));

  } );

  it("Add New ArchMod", async () => {
    let archMod = await addNewArchMod();

    assert.isNotNull(archMod);
    assert.isTrue(await isExists(archMod));

    await deleteElement(archMod);

    assert.isFalse(await isExists(archMod));

  } );

  it("Select ArchMod", async () => {
    let archMod = await addNewArchMod();

    await changeToItxMode();
    // Default.
    assert.isFalse(await isSelected(archMod));
    await select(archMod);
    assert.isTrue(await isSelected(archMod));
    await deselect(archMod);
    assert.isFalse(await isSelected(archMod));

    const EDITOR_ID = "editor_plane";

    await changeToGodMode();
    // Default.
    assert.isFalse(await isSelected(archMod));
    await select(archMod);
    assert.isTrue(await isSelected(archMod));
    assert.isNotEmpty(await archMod.findElements(By.id(EDITOR_ID)));
    await deselect(archMod);
    assert.isFalse(await isSelected(archMod));
    assert.isEmpty(await archMod.findElements(By.id(EDITOR_ID)));

  } );

  it("Drag ArchMod", async () => {
    let archMod = await addNewArchMod();
    let rect;

    // Drag to over top-left edge limit.
    await drag(archMod, -1 * (DEFAULT_X + DRAG_DIFF), -1 * (DEFAULT_Y + DRAG_DIFF));
    rect = await getArchModSize(archMod);
    assert.equal(rect.x, 0);
    assert.equal(rect.y, 0);

    // Drag to inner limit.
    await drag(archMod, DEFAULT_X, DEFAULT_Y);
    rect = await getArchModSize(archMod);
    assert.equal(rect.x, DEFAULT_X);
    assert.equal(rect.y, DEFAULT_Y);

    // Drag with snap.
    rect = await getArchModSize(archMod);
    let expX = rect.x + SNAP_DRAG_DIFF;
    let expY = rect.y + SNAP_DRAG_DIFF;
    let snapX = expX - expX % Def.SNAP_STEP_PIX;
    let snapY = expY - expY % Def.SNAP_STEP_PIX;
    assert.notEqual(expX, snapX);
    assert.notEqual(expY, snapY);
    await driver.actions().keyDown(Key.ALT).perform();
    await drag(archMod, SNAP_DRAG_DIFF, SNAP_DRAG_DIFF);
    await driver.actions().keyUp(Key.ALT).perform();
    rect = await getArchModSize(archMod);
    assert.equal(rect.x, snapX);
    assert.equal(rect.y, snapY);

  } );

  it("Open/Close Context Menu", async () => {
    let archMod = await addNewArchMod();

    // Check open context menu.
    assert.isFalse(await html.isDisplayed());
    let contextMenu = await openContextMenu(archMod);
    assert.isTrue(await html.isDisplayed());
    assert.isTrue(await contextMenu.isDisplayed());

    // Check context menu position.
    let contextMenuLeft = await contextMenu.getCssValue("left");
    let contextMenuTop = await contextMenu.getCssValue("top");
    assert.equal(contextMenuLeft, `${DEFAULT_X + DEFAULT_W / 2}px`);
    assert.equal(contextMenuTop,  `${DEFAULT_Y + DEFAULT_H / 2}px`);

    // Check context menu close.
    await closeContextMenu(archMod);
    assert.isEmpty(await html.findElements(By.id("context_menu_body")));
    assert.isFalse(await html.isDisplayed());

  } );

  it("Change Label", async () => {
    let archMod = await addNewArchMod();
    let NEW_LABEL = "NEW_LABEL";

    await changeLabel(archMod, NEW_LABEL);

    assert.equal(await getLabel(archMod), NEW_LABEL);

  } );

  it("Change Label Rotate", async () => {
    let archMod = await addNewArchMod();
    let label = await getLabel(archMod);
    let labelNode = await archMod.findElement(By.id(`text_${label}`));
    let rect = await getArchModSize(archMod);
    let contextMenu;

    // Default.
    let rot = await labelNode.getAttribute("transform");
    assert.equal(rot, `rotate(0,${rect.x + rect.width / 2},${rect.y + rect.height / 2})`);

    // Change to vertical.
    await changeLabelRotToVertical(archMod);
    let rotV = await labelNode.getAttribute("transform");
    assert.equal(rotV, `rotate(270,${rect.x + rect.width / 2},${rect.y + rect.height / 2})`);

    // Change to horizontal.
    await changeLabelRotToHorizontal(archMod);
    let rotH = await labelNode.getAttribute("transform");
    assert.equal(rotH, `rotate(0,${rect.x + rect.width / 2},${rect.y + rect.height / 2})`);

  } );

  it("Check L-Shape Interaction", async () => {
    let archMod = await addNewArchMod();

    // Default.
    assert.isEmpty(await archMod.findElements(By.id("grip_pin")));

    // Change to Left-Top.
    archMod = await resetArchMod(archMod);
    await changeClipAreaToLeftTop(archMod);
    await testClipArea(archMod);

    // Change to Right-Top.
    archMod = await resetArchMod(archMod);
    await changeClipAreaToRightTop(archMod);
    await testClipArea(archMod);

    // Change to Left-Bottom.
    archMod = await resetArchMod(archMod);
    await changeClipAreaToLeftBottom(archMod);
    await testClipArea(archMod);

    // Change to Right-Bottom.
    archMod = await resetArchMod(archMod);
    await changeClipAreaToRightBottom(archMod);
    await testClipArea(archMod);

    // Change to None.
    // Currently, gripPin is on right-bottom edge, so contextClick can be handled.
    await changeClipAreaToNone(archMod);
    assert.isEmpty(await archMod.findElements(By.id("grip_pin")));

  } );

  async function testClipArea(archMod: WebElement) {
    await select(archMod);

    let gripPin = await archMod.findElement(By.id("grip_pin"));
    assert.isNotNull(gripPin);
    let gripLeftTop = await archMod.findElement(By.id("grip_left_top"));
    assert.isNotNull(gripLeftTop);
    let gripRightTop = await archMod.findElement(By.id("grip_right_top"));
    assert.isNotNull(gripRightTop);
    let gripLeftBottom = await archMod.findElement(By.id("grip_left_bottom"));
    assert.isNotNull(gripLeftBottom);
    let gripRightBottom = await archMod.findElement(By.id("grip_right_bottom"));
    assert.isNotNull(gripRightBottom);

    let rect;
    let expX;
    let expY;
    let snapX;
    let snapY;

    // Check pin drag snap.
    rect = await getArchModSize(archMod);
    expX = rect.pinX + SNAP_DRAG_DIFF;
    expY = rect.pinY + SNAP_DRAG_DIFF;
    snapX = expX - expX % Def.SNAP_STEP_PIX;
    snapY = expY - expY % Def.SNAP_STEP_PIX;
    assert.notEqual(expX, snapX);
    assert.notEqual(expY, snapY);
    await driver.actions().keyDown(Key.ALT).perform();
    await drag(gripPin, SNAP_DRAG_DIFF, SNAP_DRAG_DIFF);
    await driver.actions().keyUp(Key.ALT).perform();
    rect = await getArchModSize(archMod);
    assert.equal(rect.pinX, snapX);
    assert.equal(rect.pinY, snapY);

    // Check pin drag to Top-Left.
    await drag(gripPin, -1 * rect.width, -1 * rect.height);
    rect = await getArchModSize(archMod);
    assert.equal(rect.pinX, rect.x + MIN_SIZE_PIX / 2);
    assert.equal(rect.pinY, rect.y + MIN_SIZE_PIX / 2);

    // Check pin drag to Top-Right.
    await drag(gripPin, rect.width, -1 * rect.height);
    rect = await getArchModSize(archMod);
    assert.equal(rect.pinX, rect.x + rect.width - MIN_SIZE_PIX / 2);
    assert.equal(rect.pinY, rect.y + MIN_SIZE_PIX / 2);

    // Check pin drag to Bottom-Left.
    await drag(gripPin, -1 * rect.width, rect.height);
    rect = await getArchModSize(archMod);
    assert.equal(rect.pinX, rect.x + MIN_SIZE_PIX / 2);
    assert.equal(rect.pinY, rect.y + rect.height - MIN_SIZE_PIX / 2);

    // Check pin drag to Bottom-Right.
    await drag(gripPin, rect.width, rect.height);
    rect = await getArchModSize(archMod);
    assert.equal(rect.pinX, rect.x + rect.width - MIN_SIZE_PIX / 2);
    assert.equal(rect.pinY, rect.y + rect.height - MIN_SIZE_PIX / 2);

    let lastRect;

    // Check drag Left-Top grip.
    await drag(gripPin, -1 * rect.width, -1 * rect.height); // move pin to left-top limit.
    lastRect = await getArchModSize(archMod);
    await drag(gripLeftTop, DRAG_DIFF, DRAG_DIFF);
    rect = await getArchModSize(archMod);
    assert.deepEqual(rect, {
        x: lastRect.x + DRAG_DIFF,
        y: lastRect.y + DRAG_DIFF,
        width: lastRect.width - DRAG_DIFF,
        height: lastRect.height - DRAG_DIFF,
        pinX: lastRect.pinX + DRAG_DIFF,
        pinY: lastRect.pinY + DRAG_DIFF,
    } );
    // Check snap drag.
    expX = rect.x - SNAP_DRAG_DIFF;
    expY = rect.y - SNAP_DRAG_DIFF;
    snapX = expX - expX % Def.SNAP_STEP_PIX;
    snapY = expY - expY % Def.SNAP_STEP_PIX;
    assert.notEqual(expX, snapX);
    assert.notEqual(expY, snapY);
    await driver.actions().keyDown(Key.ALT).perform();
    await drag(gripLeftTop, -1 * SNAP_DRAG_DIFF, -1 * SNAP_DRAG_DIFF);
    await driver.actions().keyUp(Key.ALT).perform();
    rect = await getArchModSize(archMod);
    assert.equal(rect.x, snapX);
    assert.equal(rect.y, snapY);

    // Check drag Right-Top grip.
    await drag(gripPin, rect.width, -1 * rect.height); // move pin to right-top limit.
    lastRect = await getArchModSize(archMod);
    await drag(gripRightTop, -1 * DRAG_DIFF, DRAG_DIFF);
    rect = await getArchModSize(archMod);
    assert.deepEqual(rect, {
        x: lastRect.x,
        y: lastRect.y + DRAG_DIFF,
        width: lastRect.width - DRAG_DIFF,
        height: lastRect.height - DRAG_DIFF,
        pinX: lastRect.pinX - DRAG_DIFF,
        pinY: lastRect.pinY + DRAG_DIFF,
    } );
    // Check snap drag.
    expX = rect.x + rect.width + SNAP_DRAG_DIFF;
    expY = rect.y - SNAP_DRAG_DIFF;
    snapX = expX - expX % Def.SNAP_STEP_PIX;
    snapY = expY - expY % Def.SNAP_STEP_PIX;
    assert.notEqual(expX, snapX);
    assert.notEqual(expY, snapY);
    await driver.actions().keyDown(Key.ALT).perform();
    await drag(gripRightTop, SNAP_DRAG_DIFF, -1 * SNAP_DRAG_DIFF);
    await driver.actions().keyUp(Key.ALT).perform();
    rect = await getArchModSize(archMod);
    assert.equal(rect.x + rect.width, snapX);
    assert.equal(rect.y, snapY);

    // Check drag Left-Bottom grip.
    await drag(gripPin, -1 * rect.width, rect.height); // move pin to left-bottom limit.
    lastRect = await getArchModSize(archMod);
    await drag(gripLeftBottom, DRAG_DIFF, -1 * DRAG_DIFF);
    rect = await getArchModSize(archMod);
    assert.deepEqual(rect, {
        x: lastRect.x + DRAG_DIFF,
        y: lastRect.y,
        width: lastRect.width - DRAG_DIFF,
        height: lastRect.height - DRAG_DIFF,
        pinX: lastRect.pinX + DRAG_DIFF,
        pinY: lastRect.pinY - DRAG_DIFF,
    } );
    // Check snap drag.
    expX = rect.x - SNAP_DRAG_DIFF;
    expY = rect.y + rect.height + SNAP_DRAG_DIFF;
    snapX = expX - expX % Def.SNAP_STEP_PIX;
    snapY = expY - expY % Def.SNAP_STEP_PIX;
    assert.notEqual(expX, snapX);
    assert.notEqual(expY, snapY);
    await driver.actions().keyDown(Key.ALT).perform();
    await drag(gripLeftBottom, -1 * SNAP_DRAG_DIFF, SNAP_DRAG_DIFF);
    await driver.actions().keyUp(Key.ALT).perform();
    rect = await getArchModSize(archMod);
    assert.equal(rect.x, snapX);
    assert.equal(rect.y + rect.height, snapY);

    // Check drag Right-Bottom grip.
    await drag(gripPin, rect.width, rect.height); // move pin to right-bottom limit.
    lastRect = await getArchModSize(archMod);
    await drag(gripRightBottom, -1 * DRAG_DIFF, -1 * DRAG_DIFF);
    rect = await getArchModSize(archMod);
    assert.deepEqual(rect, {
        x: lastRect.x,
        y: lastRect.y,
        width: lastRect.width - DRAG_DIFF,
        height: lastRect.height - DRAG_DIFF,
        pinX: lastRect.pinX - DRAG_DIFF,
        pinY: lastRect.pinY - DRAG_DIFF,
    } );
    // Check snap drag.
    expX = rect.x + rect.width + SNAP_DRAG_DIFF;
    expY = rect.y + rect.height + SNAP_DRAG_DIFF;
    snapX = expX - expX % Def.SNAP_STEP_PIX;
    snapY = expY - expY % Def.SNAP_STEP_PIX;
    assert.notEqual(expX, snapX);
    assert.notEqual(expY, snapY);
    await driver.actions().keyDown(Key.ALT).perform();
    await drag(gripRightBottom, SNAP_DRAG_DIFF, SNAP_DRAG_DIFF);
    await driver.actions().keyUp(Key.ALT).perform();
    rect = await getArchModSize(archMod);
    assert.equal(rect.x + rect.width, snapX);
    assert.equal(rect.y + rect.height, snapY);

  }

  it("Check ColorSet Change", async () => {
    let archMod = await addNewArchMod();

    await testArchModColorSet(archMod, "color_set_orange", ColorSet.ORANGE);
    await testArchModColorSet(archMod, "color_set_green",  ColorSet.GREEN);
    await testArchModColorSet(archMod, "color_set_blue",   ColorSet.BLUE);
    await testArchModColorSet(archMod, "color_set_yellow", ColorSet.YELLOW);
    await testArchModColorSet(archMod, "color_set_gray",   ColorSet.GRAY);

  } );

  async function testArchModColorSet(archMod: WebElement, buttonId: string, expColorSet: ColorSet) {
    await changeColorTo(archMod, buttonId);

    let polygon = await archMod.findElement(By.id("polygon_ArchMod"));
    let stroke = await polygon.getAttribute("stroke");
    let fill = await polygon.getAttribute("fill");

    let resolver = ColorSet.resolve(expColorSet);
    assert.equal(stroke, resolver.stroke);
    assert.equal(fill, resolver.bg);

  }

  it("Check Change Z-Order", async () => {
    let one = await addNewArchMod();
    await changeLabel(one, "one");
    let two = await addNewArchMod();
    await changeLabel(two, "two");

    // Make overlap and non-overlap area.
    await drag(two, DEFAULT_W / 2 + DRAG_DIFF, DEFAULT_H / 2 + DRAG_DIFF);

    let overlapX = DEFAULT_W / 2 + DRAG_DIFF * 2;
    let overlapY = DEFAULT_H / 2 + DRAG_DIFF * 2;

    await click(one, overlapX, overlapY);
    assert.isFalse(await isSelected(one));
    assert.isTrue(await isSelected(two));
    await deselect(two);

    await lower(two);

    await click(one, overlapX, overlapY);
    assert.isTrue(await isSelected(one));
    assert.isFalse(await isSelected(two));
    await deselect(one);

    await raise(two);

    await click(one, overlapX, overlapY);
    assert.isFalse(await isSelected(one));
    assert.isTrue(await isSelected(two));
    await deselect(two);

  } );

  it("Add New Divider Line", async () => {
    const ID = "dividerline";

    let line0 = await addNewDividerLine();
    assert.isNotNull(line0);
    let label0 = await getLabel(line0);
    assert.equal(label0, "0");
    await deleteElement(line0);
    assert.isEmpty(await driver.findElements(By.id(`${ID}_0`)));

    let line1 = await addNewDividerLine();
    assert.isNotNull(line1);
    let label1 = await getLabel(line1);
    assert.equal(label1, "1");
    let line2 = await addNewDividerLine();
    assert.isNotNull(line2);
    let label2 = await getLabel(line2);
    assert.equal(label2, "2");

    assert.isNotEmpty(await driver.findElements(By.id(`${ID}_2`)));
    assert.isNotEmpty(await driver.findElements(By.id(`${ID}_1`)));
    await deleteElement(line2);
    assert.isEmpty(await driver.findElements(By.id(`${ID}_2`)));
    assert.isNotEmpty(await driver.findElements(By.id(`${ID}_1`)));
    await deleteElement(line1);
    assert.isEmpty(await driver.findElements(By.id(`${ID}_2`)));
    assert.isEmpty(await driver.findElements(By.id(`${ID}_1`)));

  } );

  it("Select Divider Line", async () => {
    let line = await addNewDividerLine();

    await line.click();
    assert.isTrue(await isSelected(line));

    await line.click();
    assert.isFalse(await isSelected(line));

  } );

  it("Divider Line Context Menu Open/Close", async () => {
    let line = await addNewDividerLine();

    await changeToItxMode();

    await line.click();
    assert.isEmpty(await line.findElements(By.id("editor_plane")));
    await contextClick(line);
    assert.isEmpty(await html.findElements(By.id("context_menu_body")));

    await changeToGodMode();

    await line.click();
    assert.isNotEmpty(await line.findElements(By.id("editor_plane")));
    await contextClick(line);
    assert.isNotEmpty(await html.findElements(By.id("context_menu_body")));

  } );

  it("Drag Divider Line", async () => {
    let d;
    let fromX;
    let fromY;
    let toX;
    let toY;

    let line = await addNewDividerLine();
    let path = await line.findElement(By.id("path"));

    d = await path.getAttribute("d");
    fromX = DEFAULT_X;
    fromY = DEFAULT_Y;
    toX = DEFAULT_X + DEFAULT_W;
    toY = DEFAULT_Y + DEFAULT_H;
    assert.equal(d, `M${fromX},${fromY}L${toX},${toY}`);

    await line.click();
    await drag(line, DRAG_DIFF, DRAG_DIFF);

    d = await path.getAttribute("d");
    fromX += DRAG_DIFF;
    fromY += DRAG_DIFF;
    toX += DRAG_DIFF;
    toY += DRAG_DIFF;
    assert.equal(d, `M${fromX},${fromY}L${toX},${toY}`);

    // Check snap drag.
    let expFromX = fromX + SNAP_DRAG_DIFF;
    let expFromY = fromY + SNAP_DRAG_DIFF;
    let snapFromX = expFromX - expFromX % Def.SNAP_STEP_PIX;
    let snapFromY = expFromY - expFromY % Def.SNAP_STEP_PIX;
    let snapToX = toX + snapFromX - fromX;
    let snapToY = toY + snapFromY - fromY;
    assert.notEqual(expFromX, snapFromX);
    assert.notEqual(expFromY, snapFromY);
    await line.click();
    await driver.actions().keyDown(Key.ALT).perform();
    await drag(line, SNAP_DRAG_DIFF, SNAP_DRAG_DIFF);
    await driver.actions().keyUp(Key.ALT).perform();
    d = await path.getAttribute("d");
    assert.equal(d, `M${snapFromX},${snapFromY}L${snapToX},${snapToY}`);

  } );

  it("Edit Divider Line", async () => {
    let line = await addNewDividerLine();
    let path = await line.findElement(By.id("path"));
    let d;

    await select(line); // edit
    assert.isNotEmpty(await line.findElements(By.id("editor_plane")));

    let fromGrip = await line.findElement(By.id("from_grip"));
    let toGrip = await line.findElement(By.id("to_grip"));

    await drag(fromGrip, DRAG_DIFF, DRAG_DIFF * 2);
    await drag(toGrip, DRAG_DIFF * 2, DRAG_DIFF);

    let fromX = DEFAULT_X + DRAG_DIFF;
    let fromY = DEFAULT_Y + DRAG_DIFF * 2;
    let toX = DEFAULT_X + DEFAULT_W + DRAG_DIFF * 2;
    let toY = DEFAULT_Y + DEFAULT_H + DRAG_DIFF;

    d = await path.getAttribute("d");
    assert.equal(d, `M${fromX},${fromY}L${toX},${toY}`);

    // Snap drag.
    await driver.actions().keyDown(Key.ALT).perform();
    await drag(fromGrip, -1 * SNAP_DRAG_DIFF, -1 * SNAP_DRAG_DIFF);
    await drag(toGrip, SNAP_DRAG_DIFF, SNAP_DRAG_DIFF);
    await driver.actions().keyUp(Key.ALT).perform();

    let expFromX = fromX - SNAP_DRAG_DIFF;
    let expFromY = fromY - SNAP_DRAG_DIFF;
    let snapFromX = expFromX - expFromX % Def.SNAP_STEP_PIX;
    let snapFromY = expFromY - expFromY % Def.SNAP_STEP_PIX;
    let expToX = toX + SNAP_DRAG_DIFF;
    let expToY = toY + SNAP_DRAG_DIFF;
    let snapToX = expToX - expToX % Def.SNAP_STEP_PIX;
    let snapToY = expToY - expToY % Def.SNAP_STEP_PIX;

    d = await path.getAttribute("d");
    assert.equal(d, `M${snapFromX},${snapFromY}L${snapToX},${snapToY}`);

    await deselect(line); // cancel
    assert.isEmpty(await line.findElements(By.id("editor_plane")));

  } );

  it("Change Divider Line Color Set", async () => {
    let line = await addNewDividerLine();

    await testDividerLineColorSet(line, "color_set_orange", ColorSet.ORANGE);
    await testDividerLineColorSet(line, "color_set_green",  ColorSet.GREEN);
    await testDividerLineColorSet(line, "color_set_blue",   ColorSet.BLUE);
    await testDividerLineColorSet(line, "color_set_yellow", ColorSet.YELLOW);
    await testDividerLineColorSet(line, "color_set_gray",   ColorSet.GRAY);

  } );

  async function testDividerLineColorSet(line: WebElement, buttonId: string, expColorSet: ColorSet) {
    await changeColorTo(line, buttonId);

    let path = await line.findElement(By.id("path"));
    let stroke = await path.getAttribute("stroke");

    let resolver = ColorSet.resolve(expColorSet);
    assert.equal(stroke, resolver.bg);

  }

  it("Change Divider Line Z-Order", async () => {
    let one = await addNewDividerLine();
    let two = await addNewDividerLine();

    // Make overlap and non-overlap area.
    await drag(two, DEFAULT_W / 2 + DRAG_DIFF, DEFAULT_H / 2 + DRAG_DIFF);

    let overlapX = DEFAULT_W / 2 + DRAG_DIFF * 2;
    let overlapY = DEFAULT_H / 2 + DRAG_DIFF * 2;

    await click(one, overlapX, overlapY);
    assert.isFalse(await isSelected(one));
    assert.isTrue(await isSelected(two));
    await deselect(two);

    await lower(two);

    await click(one, overlapX, overlapY);
    assert.isTrue(await isSelected(one));
    assert.isFalse(await isSelected(two));
    await deselect(one);

    await raise(two);

    await click(one, overlapX, overlapY);
    assert.isFalse(await isSelected(one));
    assert.isTrue(await isSelected(two));
    await deselect(two);

  } );

  it("Check Download JSON", async () => {
    let archMod = await addNewArchMod();
    let line = await addNewDividerLine();

    let actJson = await getLatestJson();

    let expJson = {
      [Def.KEY_VERSION]: Def.VAL_VERSION,
      [Def.KEY_OUT_FRAME]: {
        [Def.KEY_X]: 0,
        [Def.KEY_Y]: 0,
        [Def.KEY_WIDTH]: DEFAULT_OUT_FRAME_W,
        [Def.KEY_HEIGHT]: DEFAULT_OUT_FRAME_H,
      },
      [Def.KEY_ARCHITECTURE_MAP]: [
        {
          [Def.KEY_CLASS]: "ArchMod",
          [Def.KEY_LABEL]: LABEL,
          [Def.KEY_DIMENS]: {
             [Def.KEY_X]: DEFAULT_X,
             [Def.KEY_Y]: DEFAULT_Y,
             [Def.KEY_WIDTH]: DEFAULT_W,
             [Def.KEY_HEIGHT]: DEFAULT_H,
             [Def.KEY_PIN_X]: DEFAULT_X + DEFAULT_W / 2,
             [Def.KEY_PIN_Y]: DEFAULT_Y + DEFAULT_H / 2,
             [Def.KEY_LABEL_ROT_DEG]: 0,
           },
           [Def.KEY_CLIP_AREA]: "none",
           [Def.KEY_COLOR_SET]: "gray",
        },
        {
          [Def.KEY_CLASS]: "DividerLine",
          [Def.KEY_DIMENS]: {
              [Def.KEY_FROM_X]: DEFAULT_X,
              [Def.KEY_FROM_Y]: DEFAULT_Y,
              [Def.KEY_TO_X]: DEFAULT_X + DEFAULT_W,
              [Def.KEY_TO_Y]: DEFAULT_Y + DEFAULT_H,
              [Def.KEY_WIDTH]: 4,
          },
          [Def.KEY_COLOR_SET]: "gray",
        },
      ],
    };

    assert.deepEqual(actJson, expJson);

  } );

  it("Check UNDO/REDO History", async () => {
    let history = [];

    await resizeOutFrame(DRAG_DIFF, DRAG_DIFF);
    history.push(await getLatestJson());

    let one = await addNewArchMod();
    history.push(await getLatestJson());

    await drag(one, DEFAULT_W / 2 + DRAG_DIFF, DEFAULT_H / 2 + DRAG_DIFF);
    history.push(await getLatestJson());

    await changeLabel(one, "one");
    history.push(await getLatestJson());

    await changeLabelRotToVertical(one);
    history.push(await getLatestJson());

    await changeClipAreaToLeftTop(one);
    history.push(await getLatestJson());

    await select(one); // edit
    let gripPin = await one.findElement(By.id("grip_pin"));
    await drag(gripPin, -1 * DRAG_DIFF, -1 * DRAG_DIFF);
    await deselect(one);
    history.push(await getLatestJson());

    await changeColorTo(one, "color_set_green");
    history.push(await getLatestJson());

    let two = await addNewArchMod();
    await changeLabel(two, "two");
    history.push(await getLatestJson());

    await lower(two);
    history.push(await getLatestJson());

    await raise(two);
    history.push(await getLatestJson());

    let line = await addNewDividerLine();
    history.push(await getLatestJson());

    await drag(line, DEFAULT_W, -1 * DEFAULT_H);
    history.push(await getLatestJson());

    await select(line); //edit
    let fromGrip = await line.findElement(By.id("from_grip"));
    await drag(fromGrip, -1 * DRAG_DIFF, -1 * DRAG_DIFF);
    await deselect(line);
    history.push(await getLatestJson());

    await select(line); //edit
    let toGrip = await line.findElement(By.id("to_grip"));
    await drag(toGrip, DRAG_DIFF, DRAG_DIFF);
    await deselect(line);
    history.push(await getLatestJson());

    await changeColorTo(line, "color_set_blue");
    history.push(await getLatestJson());

    await lower(line);
    history.push(await getLatestJson());

    // Check there is NO same history.
    for (let i = 0; i <= history.length - 2; i++) {
      assert.notDeepEqual(history[i], history[i + 1]);
    }

    // UNDO.
    await undo();
    let undo1 = await getLatestJson();
    assert.deepEqual(undo1, history[history.length - 1 - 1]);
    for (let i = 0; i < history.length; i++) {
      await undo();
    }
    let undoLast = await getLatestJson();
    assert.deepEqual(undoLast, history[0]);

    // REDO.
    await redo();
    let redo1 = await getLatestJson();
    assert.deepEqual(redo1, history[1]);
    for (let i = 0; i < history.length; i++) {
      await redo();
    }
    let redoLast = await getLatestJson();
    assert.deepEqual(redoLast, history[history.length - 1]);

  } );

  ///////////////////////////////////////////////////////////////////////////////// TEST CASE ////

  //// DRIVER-DEPENDENT UTIL FUNCTIONS ///////////////////////////////////////////////////////////

  async function changeToGodMode() {
    let godModeButton = await driver.findElement(By.id("god_mode"));
    godModeButton.click();
  }

  async function changeToItxMode() {
    let itxModeButton = await driver.findElement(By.id("itx_mode"));
    itxModeButton.click();
  }

  async function selectOutFrame() {
    let outFrame = await driver.findElement(By.id("out_frame"));
    await click(outFrame, 0, 0);
  }

  async function deselectOutFrame() {
    await svg.click();
  }

  async function resizeOutFrame(x: number, y: number) {
    await selectOutFrame();
    let outFrame = await driver.findElement(By.id("out_frame"));
    let grip = await outFrame.findElement(By.id("grip_right_bottom"));
    await drag(grip, DRAG_DIFF, DRAG_DIFF);
    await deselectOutFrame();
  }

  async function isSelectable(element: WebElement): Promise<boolean> {
    let id = await element.getAttribute("id");
    if (id.startsWith("archmod_")) return true;
    if (id.startsWith("dividerline_")) return true;
    return false;
  }

  async function select(element: WebElement) {
    let selected = await isSelected(element);
    if (!selected) {
      let id = await element.getAttribute("id");
      if (id.startsWith("archmod_")) {
        // May be L-Shaped, if center is empty, element.click() does not hit. So, click pin pos.
        let size = await getArchModSize(element);
        await click(element, size.pinX - size.x, size.pinY - size.y);
      } else {
        await element.click();
      }
    }
  }

  async function deselect(element: WebElement) {
    let selected = await isSelected(element);
    if (selected) {
      await element.click();
    }
  }

  async function addNewArchMod(): Promise<WebElement> {
    let addButton = await driver.findElement(By.id("add_archmod"));
    await addButton.click();
    await click(html, DEFAULT_X, DEFAULT_Y);
    return await svg.findElement(By.id("archmod_ArchMod"));
  }

  async function resetArchMod(archMod: WebElement): Promise<WebElement> {
    await deleteElement(archMod);
    return await addNewArchMod();
  }

  async function addNewDividerLine(): Promise<WebElement> {
    let addButton = await driver.findElement(By.id("add_dividerline"));
    await addButton.click();
    await click(html, DEFAULT_X, DEFAULT_Y);

    let label = await getLatestAddedElementLabel();
    return await svg.findElement(By.id(`dividerline_${label}`));
  }

  async function getLatestAddedElementLabel(): Promise<string> {
    let inject = (): string => {
      let allElements = (window as any).getContext().allElements;
      return allElements[allElements.length - 1].label;
    };

    return await driver.executeScript(inject);
  }

  async function getLabel(element: WebElement): Promise<string> {
    let label = await element.getAttribute("id");
    label = label.replace(/^archmod\_/, '');
    label = label.replace(/^dividerline\_/, '');
    return label;
  }

  async function deleteElement(element: WebElement) {
    await select(element);
    await driver.actions()
        .keyDown(Key.DELETE)
        .keyUp(Key.DELETE)
        .perform();
  }

  async function openContextMenu(element: WebElement): Promise<WebElement> {
    await select(element);
    await contextClick(element);
    return await html.findElement(By.id("context_menu_body"));
  }

  async function closeContextMenu(element: WebElement) {
    await click(html, 0, 0);
    await deselect(element);
  }

  async function changeLabel(archMod: WebElement, newLabel: string) {
    let oldLabel = await getLabel(archMod);

    let contextMenu = await openContextMenu(archMod);
    let inputLabel = await contextMenu.findElement(By.id("input_label"));

    for (let i = 0; i <= oldLabel.length; i++) {
      await inputLabel.sendKeys(Key.BACK_SPACE);
    }
    await inputLabel.sendKeys(newLabel);

    await closeContextMenu(archMod);
  }

  async function changeLabelRotToHorizontal(archMod: WebElement) {
    await changeLabelRotTo(archMod, "label_rot_horizontal");
  }

  async function changeLabelRotToVertical(archMod: WebElement) {
    await changeLabelRotTo(archMod, "label_rot_vertical");
  }

  async function changeLabelRotTo(archMod: WebElement, buttonId: string) {
    let contextMenu = await openContextMenu(archMod);
    let button = await contextMenu.findElement(By.id(buttonId));
    await button.click();
    await closeContextMenu(archMod);

  }

  async function changeClipAreaTo(archMod: WebElement, id: string) {
    let contextMenu = await openContextMenu(archMod);
    let button = await contextMenu.findElement(By.id(id));
    await button.click();
    await closeContextMenu(archMod);
  }

  async function changeClipAreaToNone(archMod: WebElement) {
    await changeClipAreaTo(archMod, "clip_area_none");
  }

  async function changeClipAreaToLeftTop(archMod: WebElement) {
    await changeClipAreaTo(archMod, "clip_area_left_top");
  }

  async function changeClipAreaToRightTop(archMod: WebElement) {
    await changeClipAreaTo(archMod, "clip_area_right_top");
  }

  async function changeClipAreaToLeftBottom(archMod: WebElement) {
    await changeClipAreaTo(archMod, "clip_area_left_bottom");
  }

  async function changeClipAreaToRightBottom(archMod: WebElement) {
    await changeClipAreaTo(archMod, "clip_area_right_bottom");
  }

  async function changeColorTo(element: WebElement, buttonId: string) {
    let contextMenu = await openContextMenu(element);
    let button = await contextMenu.findElement(By.id(buttonId));
    await button.click();
    await closeContextMenu(element);

  }

  async function raise(element: WebElement) {
    await changeZOrder(element, "z_order_front");
  }

  async function lower(element: WebElement) {
    await changeZOrder(element, "z_order_back");
  }

  async function changeZOrder(element: WebElement, buttonId: string) {
    let contextMenu = await openContextMenu(element);
    let button = await contextMenu.findElement(By.id(buttonId));
    await button.click();
    await closeContextMenu(element);
  }

  async function undo() {
    await driver.actions()
        .keyDown(Key.CONTROL)
        .keyDown("z")
        .keyUp("z")
        .keyUp(Key.CONTROL)
        .perform();
  }

  async function redo() {
    await driver.actions()
        .keyDown(Key.CONTROL)
        .keyDown("y")
        .keyUp("y")
        .keyUp(Key.CONTROL)
        .perform();
  }



  // XY -1 means to calc center.
  async function calcXY(element: WebElement, x: number, y: number): Promise<{ x: number, y: number }> {
    let rect = await element.getRect();

    let originX: number = -1 * rect.width / 2;
    let originY: number = -1 * rect.height / 2;

    // WORKAROUND: y position may be float. So, modify 1 pixel.
    let yDiff = Math.ceil(rect.y) - Math.floor(rect.y);

    if (x == -1) x = rect.width / 2;
    if (y == -1) y = rect.height / 2;

    return {
      x: originX + x,
      y: originY + y + yDiff,
    };
  }

  // X-Y coordinates based on TOP-LEFT.
  async function click(element: WebElement, x: number, y: number) {
    let xy = await calcXY(element, x, y);
    await driver.actions()
        .move( { // Move to origin of SVG and HTML root.
            origin: element,
            x: xy.x,
            y: xy.y,
        } )
        .click()
        .perform();
  }

  // X-Y coordinates based on TOP-LEFT.
  async function contextClick(element: WebElement, x: number = -1, y: number = -1) {
    let xy = await calcXY(element, x, y);
    await driver.actions()
        .move( { // Move to origin of SVG and HTML root.
            origin: element,
            x: xy.x,
            y: xy.y,
        } )
        .contextClick()
        .perform();
  }

  async function drag(element: WebElement, offsetX: number, offsetY: number) {
    let selectable = await isSelectable(element);

    if (selectable) await select(element);
    await driver.actions()
        .dragAndDrop(element, { x: offsetX, y: offsetY })
        .perform();
    if (selectable) await deselect(element);
  }

  async function isExists(element: WebElement): Promise<boolean> {
    let label;
    try {
      label = await getLabel(element);
    } catch(e) {
      // Not exist already.
      return false;
    }

    let inject = (label: string): boolean => {
      return (window as any).getContext().allElements.some( (element: any) => {
        return element.label == label;
      } );
    };

    return await driver.executeScript(inject, label);
  }

  async function isSelected(element: WebElement): Promise<boolean> {
    let label = await getLabel(element);

    let inject = (label: string): boolean => {
      return (window as any).getContext().selectedElements.some( (element: any) => {
        return element.label == label;
      } );
    };

    return await driver.executeScript(inject, label);
  }

  async function getArchModSize(archMod: WebElement)
      : Promise<{ x: number, y: number, width: number, height: number, pinX: number, pinY: number}> {
    let label = await getLabel(archMod);

    let inject = (label: string) => {
      let target: any = (window as any).getContext().allElements.find( (element: any) => {
        return element.TAG == "ArchMod" && element.label == label;
      } );
      return {
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
          pinX: target.pinX,
          pinY: target.pinY,
      };
    }

    return await driver.executeScript(inject, label);
  }

  async function getLatestJson(): Promise<object> {
    // Downloaded condition.
    let curCount = getDownloadedFileFullPaths().length;
    let untilDownloadDone = new Condition("Failed to download", (driver: WebDriver) => {
      let latestCount: number = getDownloadedFileFullPaths().length;
      return latestCount  == (curCount + 1);
    } );

    let jsonButton = await driver.findElement(By.id("download_json"));
    await jsonButton.click();
    await driver.wait(untilDownloadDone, TestDef.LOAD_TIMEOUT_MILLIS);

    // Downloaded file name has timestamp with sec order.
    // So, if download button is clicked multiple in 1 sec,
    // same file name will be downloaded and overwrite existing one.
    // After then, file count is not incremented, and wait condition is stuck -> timeout.
    await driver.sleep(1000);

    let actJson = loadLatestDownloadedJson();
    return actJson;
  }

  /////////////////////////////////////////////////////////// DRIVER-DEPENDENT UTIL FUNCTIONS ////

} );

//// STATIC UTIL FUNCTIONS ///////////////////////////////////////////////////////////////////////

function getDownloadedFileFullPaths(): string[] {
  let fullPaths: string[] = [];

  let files = fs.readdirSync(TestDef.DOWNLOAD_PATH);
  files.forEach( (file: string) => {
    fullPaths.push(`${TestDef.DOWNLOAD_PATH}/${file}`);
  } );

  return fullPaths;
}

function cleanDownloadPath() {
  let fullPaths = getDownloadedFileFullPaths();

  fullPaths.forEach( (fullPath: string) => {
    fs.unlinkSync(fullPath);
    console.log(`    ## Clean Download Path : DEL=${fullPath}`);
  } );
}

function loadLatestDownloadedJson(): object {
  let fullPaths = getDownloadedFileFullPaths();
  fullPaths.sort();
  let latest = fullPaths[fullPaths.length - 1];
  let jsonString = fs.readFileSync(latest).toString();
  let json = JSON.parse(jsonString);
  return json;
}

/////////////////////////////////////////////////////////////////////// STATIC UTIL FUNCTIONS ////

