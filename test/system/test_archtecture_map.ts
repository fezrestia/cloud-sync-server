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

const LABEL = "ArchMod";



//// E2E SYSTEM TEST /////////////////////////////////////////////////////////////////////////////

describe("Test Architecture Map Web SPA Interaction", () => {
  let driver: ThenableWebDriver;
  let svg: WebElement;
  let html: WebElement;

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

  it("Add New ArchMod", async () => {
    let archMod = await addNewArchMod();

    assert.isNotNull(archMod);
    assert.isTrue(await isExists(archMod));

    await deleteArchMod(archMod);

    assert.isFalse(await isExists(archMod));

  } );

  it("Select ArchMod", async () => {
    let archMod = await addNewArchMod();

    await changeToItxMode();
    // Default.
    assert.isFalse(await isSelected(archMod));
    await selectArchMod(archMod);
    assert.isTrue(await isSelected(archMod));
    await deselectArchMod(archMod);
    assert.isFalse(await isSelected(archMod));

    const EDITOR_ID = "editor_plane";

    await changeToGodMode();
    // Default.
    assert.isFalse(await isSelected(archMod));
    await selectArchMod(archMod);
    assert.isTrue(await isSelected(archMod));
    assert.isNotEmpty(await archMod.findElements(By.id(EDITOR_ID)));
    await deselectArchMod(archMod);
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
    await selectArchMod(archMod);

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

    let rect = await getArchModSize(archMod);

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

  }

  it("Check ColorSet Change", async () => {
    let archMod = await addNewArchMod();

    await testColorSet(archMod, "color_set_orange", ColorSet.ORANGE);
    await testColorSet(archMod, "color_set_green",  ColorSet.GREEN);
    await testColorSet(archMod, "color_set_blue",   ColorSet.BLUE);
    await testColorSet(archMod, "color_set_yellow", ColorSet.YELLOW);
    await testColorSet(archMod, "color_set_gray",   ColorSet.GRAY);

  } );

  async function testColorSet(archMod: WebElement, buttonId: string, expColorSet: ColorSet) {
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
    await deselectArchMod(two);

    await lowerArchMod(two);

    await click(one, overlapX, overlapY);
    assert.isTrue(await isSelected(one));
    assert.isFalse(await isSelected(two));
    await deselectArchMod(one);

    await raiseArchMod(two);

    await click(one, overlapX, overlapY);
    assert.isFalse(await isSelected(one));
    assert.isTrue(await isSelected(two));
    await deselectArchMod(two);

  } );

  it("Check Download JSON", async () => {
    let archMod = await addNewArchMod();

    let actJson = await getLatestJson();

    // Check JSON.
    let actArchJson = (actJson as any)[Def.KEY_ARCHITECTURE_MAP];
    let expArchJson = [
        {
          "class": "ArchMod",
           "label": LABEL,
           "dimens": {
             "x": DEFAULT_X,
             "y": DEFAULT_Y,
             "width": DEFAULT_W,
             "height": DEFAULT_H,
             "pin_x": DEFAULT_X + DEFAULT_W / 2,
             "pin_y": DEFAULT_Y + DEFAULT_H / 2,
             "label_rot_deg": 0
           },
           "clip_area": "none",
           "color_set": "gray"
        }
    ];
    assert.deepEqual(actArchJson, expArchJson);

  } );

  it("Check UNDO/REDO History", async () => {
    let history = [];

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

    await selectArchMod(one); // edit
    let gripPin = await one.findElement(By.id("grip_pin"));
    await drag(gripPin, -1 * DRAG_DIFF, -1 * DRAG_DIFF);
    await deselectArchMod(one);
    history.push(await getLatestJson());

    await changeColorTo(one, "color_set_green");
    history.push(await getLatestJson());

    let two = await addNewArchMod();
    await changeLabel(two, "two");
    history.push(await getLatestJson());

    await lowerArchMod(two);
    history.push(await getLatestJson());

    await raiseArchMod(two);
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



  //// UTIL FUNCTIONS ////////////////////////////////////////////////////////////////////////////

  async function changeToGodMode() {
    let godModeButton = await driver.findElement(By.id("god_mode"));
    godModeButton.click();
  }

  async function changeToItxMode() {
    let itxModeButton = await driver.findElement(By.id("itx_mode"));
    itxModeButton.click();
  }

  async function selectArchMod(archMod: WebElement) {
    let selected = await isSelected(archMod);
    if (!selected) {
      await archMod.click();
    }
  }

  async function deselectArchMod(archMod: WebElement) {
    let selected = await isSelected(archMod);
    if (selected) {
      await archMod.click();
    }
  }

  async function addNewArchMod(): Promise<WebElement> {
    let addButton = await driver.findElement(By.id("add_archmod"));
    await addButton.click();
    await click(html, DEFAULT_X, DEFAULT_Y);
    return await svg.findElement(By.id("archmod_ArchMod"));
  }

  async function getLabel(archMod: WebElement): Promise<string> {
    let id = await archMod.getAttribute("id");
    let label = id.replace(/^archmod\_/, '');
    return label;
  }

  async function deleteArchMod(archMod: WebElement) {
    await selectArchMod(archMod);
    await driver.actions()
        .keyDown(Key.DELETE)
        .keyUp(Key.DELETE)
        .perform();
  }

  async function resetArchMod(archMod: WebElement): Promise<WebElement> {
    await deleteArchMod(archMod);
    return await addNewArchMod();
  }

  async function openContextMenu(archMod: WebElement): Promise<WebElement> {
    await selectArchMod(archMod);
    await contextClick(archMod);
    return await html.findElement(By.id("context_menu_body"));
  }

  async function closeContextMenu(archMod: WebElement) {
    await click(html, 0, 0);
    await deselectArchMod(archMod);
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

  async function changeColorTo(archMod: WebElement, buttonId: string) {
    let contextMenu = await openContextMenu(archMod);
    let button = await contextMenu.findElement(By.id(buttonId));
    await button.click();
    await closeContextMenu(archMod);

  }

  async function raiseArchMod(archMod: WebElement) {
    await changeZOrder(archMod, "z_order_front");
  }

  async function lowerArchMod(archMod: WebElement) {
    await changeZOrder(archMod, "z_order_back");
  }

  async function changeZOrder(archMod: WebElement, buttonId: string) {
    let contextMenu = await openContextMenu(archMod);
    let button = await contextMenu.findElement(By.id(buttonId));
    await button.click();
    await closeContextMenu(archMod);
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
    let id = await element.getAttribute("id");
    let isArchMod = id.startsWith("archmod_");

    if (isArchMod) await selectArchMod(element);

    await driver.actions()
        .dragAndDrop(element, { x: offsetX, y: offsetY })
        .perform();

    if (isArchMod) await deselectArchMod(element);
  }

  async function isExists(archMod: WebElement): Promise<boolean> {
    let label;
    try {
      label = await getLabel(archMod);
    } catch(e) {
      // Not exist already.
      return false;
    }

    let inject = (label: string): boolean => {
      return (window as any).getContext().allElements.some( (element: any) => {
        return element.TAG == "ArchMod" && element.label == label;
      } );
    };

    return await driver.executeScript(inject, label);
  }

  async function isSelected(archMod: WebElement): Promise<boolean> {
    let label = await getLabel(archMod);

    let inject = (label: string): boolean => {
      return (window as any).getContext().selectedElements.some( (element: any) => {
        return element.TAG == "ArchMod" && element.label == label;
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

    await driver.sleep(500); // TODO: How to detect download is done safely ?

    let actJson = loadLatestDownloadedJson();
    return actJson;
  }



} );

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

