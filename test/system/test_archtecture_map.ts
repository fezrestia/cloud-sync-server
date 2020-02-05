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



//// E2E SYSTEM TEST ////

describe("Test Architecture Map Web", () => {
  let driver: ThenableWebDriver;
  let root: WebElement;
  let svg: WebElement;
  let html: WebElement;

  before( () => {
    cleanDownloadPath();
    driver = prepareWebDriver(IS_HEADLESS);
  } );

  after( () => {
    releaseWebDriver(driver);
  } );

  it("Get Root", async () => {
    await driver.get(TARGET_URL);

    let title = await driver.getTitle();
    assert.equal(title, "Architecture Map");

    let divRoot = await driver.findElement(By.id("root"));
    assert.isNotNull(divRoot);
    let svg = await divRoot.findElement(By.id("svg_root"));
    assert.isNotNull(svg);
    let html = await divRoot.findElement(By.id("html_root"));
    assert.isNotNull(html);

    let outFrame = await svg.findElement(By.id("out_frame"));
    assert.isNotNull(outFrame);

  } );

  it("Change Global Mode", async () => {
    await driver.get(TARGET_URL);

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
    await driver.get(TARGET_URL);

    // Elements.
    root = await driver.findElement(By.id("root"));
    svg = await driver.findElement(By.id("svg_root"));
    html = await driver.findElement(By.id("html_root"));
    let contextMenu = null;
    let editor = null;
    let rect = null;

    let LABEL = "ArchMod";

    // Check Add/Delete.
    let archMod = await addNewArchMod();
    assert.isNotNull(archMod);
    assert.isTrue(await isArchModExists(LABEL));
    await deleteArchMod(archMod, LABEL);
    assert.isFalse(await isArchModExists(LABEL));

    archMod = await addNewArchMod();
    // Check selection.
    assert.isFalse(await isArchModSelected(LABEL));
    await archMod.click();
    assert.isTrue(await isArchModSelected(LABEL));
    await svg.click();
    assert.isFalse(await isArchModSelected(LABEL));

    // Check editing.
    await archMod.click();
    editor = await archMod.findElement(By.id("editor_plane"));
    assert.isNotNull(editor);

    // Check drag to top-left edge limit.
    await drag(archMod, -1 * (DEFAULT_X + 1), -1 * (DEFAULT_Y + 1));
    rect = await getArchModSize(LABEL);
    assert.equal(rect.x, 0);
    assert.equal(rect.y, 0);
    await drag(archMod, DEFAULT_X, DEFAULT_Y);
    rect = await getArchModSize(LABEL);
    assert.equal(rect.x, DEFAULT_X);
    assert.equal(rect.y, DEFAULT_Y);

    // Check context menu open.
    assert.isFalse(await html.isDisplayed());
    contextMenu = await openContextMenu(archMod);
    assert.isTrue(await html.isDisplayed());
    assert.isTrue(await contextMenu.isDisplayed());

    // Check context menu position.
    let contextMenuLeft = await contextMenu.getCssValue("left");
    let contextMenuTop = await contextMenu.getCssValue("top");
    assert.equal(contextMenuLeft, `${DEFAULT_X + DEFAULT_W / 2}px`);
    assert.equal(contextMenuTop,  `${DEFAULT_Y + DEFAULT_H / 2}px`);

    // Check context menu close.
    await closeContextMenu();
    let isContextMenuRemoved = false;
    try {
      await html.findElement(By.id("context_menu_body"));
    } catch (e) {
      isContextMenuRemoved = true;
    }
    assert.isTrue(isContextMenuRemoved);
    assert.isFalse(await html.isDisplayed());

    // Check label change.
    let MOD_LABEL = "MOD";
    await changeLabel(archMod, LABEL, MOD_LABEL);
    assert.isTrue(await isArchModSelected(MOD_LABEL));

    archMod = await resetArchMod(archMod, MOD_LABEL);
    await selectArchMod(archMod, LABEL);

    // Check label rotate.
    rect = await getArchModSize(LABEL);
    let labelNode = await archMod.findElement(By.id(`text_${LABEL}`));
    let rotate = await labelNode.getAttribute("transform");
    assert.equal(rotate, `rotate(0,${rect.x + rect.width / 2},${rect.y + rect.height / 2})`);
    contextMenu = await openContextMenu(archMod);
    let rotVertical = await contextMenu.findElement(By.id("label_rot_vertical"));
    await rotVertical.click();
    await closeContextMenu();
    let rotV = await labelNode.getAttribute("transform");
    assert.equal(rotV, `rotate(270,${rect.x + rect.width / 2},${rect.y + rect.height / 2})`);
    contextMenu = await openContextMenu(archMod);
    let rotHorizontal = await contextMenu.findElement(By.id("label_rot_horizontal"));
    await rotHorizontal.click();
    await closeContextMenu();
    let rotH = await labelNode.getAttribute("transform");
    assert.equal(rotH, `rotate(0,${rect.x + rect.width / 2},${rect.y + rect.height / 2})`);

    // Check L-shape ITX.
    archMod = await resetArchMod(archMod, LABEL);
    await selectArchMod(archMod, LABEL);
    await changeClipAreaToLeftTop(archMod);
    await testClipArea(archMod, LABEL);
    archMod = await resetArchMod(archMod, LABEL);
    await selectArchMod(archMod, LABEL);
    await changeClipAreaToRightTop(archMod);
    await testClipArea(archMod, LABEL);
    archMod = await resetArchMod(archMod, LABEL);
    await selectArchMod(archMod, LABEL);
    await changeClipAreaToLeftBottom(archMod);
    await testClipArea(archMod, LABEL);
    archMod = await resetArchMod(archMod, LABEL);
    await selectArchMod(archMod, LABEL);
    await changeClipAreaToRightBottom(archMod);
    await testClipArea(archMod, LABEL);
    // Currently, gripPin is on right-bottom edge, so contextClick can be handled.
    await selectArchMod(archMod, LABEL);
    await changeClipAreaToNone(archMod);
    let isNoPin = false
    try {
      await archMod.findElement(By.id("grip_pin"));
    } catch (e) {
      isNoPin = true;
    }
    assert.isTrue(isNoPin);

    // Check ColorSet change.
    await testColorSet(archMod, "color_set_orange", ColorSet.ORANGE);
    await testColorSet(archMod, "color_set_green",  ColorSet.GREEN);
    await testColorSet(archMod, "color_set_blue",   ColorSet.BLUE);
    await testColorSet(archMod, "color_set_yellow", ColorSet.YELLOW);
    await testColorSet(archMod, "color_set_gray",   ColorSet.GRAY);

    await deleteArchMod(archMod, LABEL);

    // Check Z-Order.
    let one = await addNewArchMod();
    await changeLabel(one, LABEL, "one");
    let two = await addNewArchMod();
    await changeLabel(two, LABEL, "two");

    await selectArchMod(two, "two");
    await drag(two, DEFAULT_W / 2 + DRAG_DIFF, DEFAULT_H / 2 + DRAG_DIFF);
    await two.click(); // deselect.

    await click(one, DEFAULT_W / 2 + DRAG_DIFF * 2, DEFAULT_H / 2 + DRAG_DIFF * 2); // click on overlap area.
    assert.isFalse(await isArchModSelected("one"));
    assert.isTrue(await isArchModSelected("two"));
    await two.click(); // deselect.

    await lowerArchMod(two);

    await click(one, DEFAULT_W / 2 + DRAG_DIFF * 2, DEFAULT_H / 2 + DRAG_DIFF * 2); // click on overlap area.
    assert.isTrue(await isArchModSelected("one"));
    assert.isFalse(await isArchModSelected("two"));
    await one.click(); // deselect.

    await raiseArchMod(two);

    await click(one, DEFAULT_W / 2 + DRAG_DIFF * 2, DEFAULT_H / 2 + DRAG_DIFF * 2); // click on overlap area.
    assert.isFalse(await isArchModSelected("one"));
    assert.isTrue(await isArchModSelected("two"));
    await two.click(); // deselect.

    await deleteArchMod(one, "one");
    await deleteArchMod(two, "two");

    // Check download JSON.
    archMod = await addNewArchMod();
    // Download JSON.
    let curCount: number = getDownloadedFileFullPaths().length;
    let untilDownloadDone = new Condition("Failed to download", (driver: WebDriver) => {
      let latestCount: number = getDownloadedFileFullPaths().length;
      return latestCount  == (curCount + 1);
    } );
    let jsonButton = await driver.findElement(By.id("download_json"));
    await jsonButton.click();
    await driver.wait(untilDownloadDone, TestDef.LOAD_TIMEOUT_MILLIS);
    // Check JSON.
    let actJson = loadLatestDownloadedJson();
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

  async function testClipArea(archMod: WebElement, label: string) {
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

    let rect = await getArchModSize(label);

    // Check pin drag to Top-Left.
    await drag(gripPin, -1 * rect.width, -1 * rect.height);
    rect = await getArchModSize(label);
    assert.equal(rect.pinX, rect.x + MIN_SIZE_PIX / 2);
    assert.equal(rect.pinY, rect.y + MIN_SIZE_PIX / 2);
    // Check pin drag to Top-Right.
    await drag(gripPin, rect.width, -1 * rect.height);
    rect = await getArchModSize(label);
    assert.equal(rect.pinX, rect.x + rect.width - MIN_SIZE_PIX / 2);
    assert.equal(rect.pinY, rect.y + MIN_SIZE_PIX / 2);
    // Check pin drag to Bottom-Left.
    await drag(gripPin, -1 * rect.width, rect.height);
    rect = await getArchModSize(label);
    assert.equal(rect.pinX, rect.x + MIN_SIZE_PIX / 2);
    assert.equal(rect.pinY, rect.y + rect.height - MIN_SIZE_PIX / 2);
    // Check pin drag to Bottom-Right.
    await drag(gripPin, rect.width, rect.height);
    rect = await getArchModSize(label);
    assert.equal(rect.pinX, rect.x + rect.width - MIN_SIZE_PIX / 2);
    assert.equal(rect.pinY, rect.y + rect.height - MIN_SIZE_PIX / 2);

    let lastRect;

    // Check drag Left-Top grip.
    await drag(gripPin, -1 * rect.width, -1 * rect.height); // move pin to left-top limit.
    lastRect = await getArchModSize(label);
    await drag(gripLeftTop, DRAG_DIFF, DRAG_DIFF);
    rect = await getArchModSize(label);
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
    lastRect = await getArchModSize(label);
    await drag(gripRightTop, -1 * DRAG_DIFF, DRAG_DIFF);
    rect = await getArchModSize(label);
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
    lastRect = await getArchModSize(label);
    await drag(gripLeftBottom, DRAG_DIFF, -1 * DRAG_DIFF);
    rect = await getArchModSize(label);
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
    lastRect = await getArchModSize(label);
    await drag(gripRightBottom, -1 * DRAG_DIFF, -1 * DRAG_DIFF);
    rect = await getArchModSize(label);
    assert.deepEqual(rect, {
        x: lastRect.x,
        y: lastRect.y,
        width: lastRect.width - DRAG_DIFF,
        height: lastRect.height - DRAG_DIFF,
        pinX: lastRect.pinX - DRAG_DIFF,
        pinY: lastRect.pinY - DRAG_DIFF,
    } );

  }

  async function testColorSet(archMod: WebElement, buttonId: string, expColorSet: ColorSet) {
    let contextMenu = await openContextMenu(archMod);
    let button = await contextMenu.findElement(By.id(buttonId));
    await button.click();

    let polygon = await archMod.findElement(By.id("polygon_ArchMod"));
    let stroke = await polygon.getAttribute("stroke");
    let fill = await polygon.getAttribute("fill");

    let resolver = ColorSet.resolve(expColorSet);
    assert.equal(stroke, resolver.stroke);
    assert.equal(fill, resolver.bg);

    await closeContextMenu();
  }



  it("END", async () => {
  } );

  async function selectArchMod(archMod: WebElement, label: string) {
    let isSelected = await isArchModSelected(label);
    if (!isSelected) {
      await archMod.click();
    }
  }

  async function addNewArchMod(): Promise<WebElement> {
    let addButton = await driver.findElement(By.id("add_archmod"));
    await addButton.click();
    await click(html, DEFAULT_X, DEFAULT_Y);
    return await svg.findElement(By.id("archmod_ArchMod"));
  }

  async function deleteArchMod(archMod: WebElement, label: string) {
    await selectArchMod(archMod, label);
    await driver.actions()
        .keyDown(Key.DELETE)
        .keyUp(Key.DELETE)
        .perform();
  }

  async function resetArchMod(archMod: WebElement, label: string): Promise<WebElement> {
    await deleteArchMod(archMod, label);
    return await addNewArchMod();
  }

  async function changeLabel(archMod: WebElement, oldLabel: string, newLabel: string) {
    await selectArchMod(archMod, oldLabel);
    let contextMenu = await openContextMenu(archMod);

    let inputLabel = await contextMenu.findElement(By.id("input_label"));

    for (let i = 0; i <= oldLabel.length; i++) {
      await inputLabel.sendKeys(Key.BACK_SPACE);
    }
    await inputLabel.sendKeys(newLabel);

    await closeContextMenu();
  }

  async function changeToGodMode() {
    let godModeButton = await driver.findElement(By.id("god_mode"));
    godModeButton.click();
  }

  async function changeToItxMode() {
    let itxModeButton = await driver.findElement(By.id("itx_mode"));
    itxModeButton.click();
  }

  async function openContextMenu(archMod: WebElement): Promise<WebElement> {
    await contextClick(archMod);
    return await html.findElement(By.id("context_menu_body"));
  }

  async function closeContextMenu() {
    await click(html, 0, 0);
  }

  async function changeClipAreaTo(archMod: WebElement, id: string) {
    let contextMenu = await openContextMenu(archMod);
    let button = await contextMenu.findElement(By.id(id));
    await button.click();
    await closeContextMenu();
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

  async function raiseArchMod(archMod: WebElement) {
    await changeZOrder(archMod, "z_order_front");
  }

  async function lowerArchMod(archMod: WebElement) {
    await changeZOrder(archMod, "z_order_back");
  }

  async function changeZOrder(archMod: WebElement, buttonId: string) {
    archMod.click();
    let contextMenu = await openContextMenu(archMod);
    let button = await contextMenu.findElement(By.id(buttonId));
    await button.click();
    await closeContextMenu();
    archMod.click();
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
    await driver.actions()
        .dragAndDrop(element, { x: offsetX, y: offsetY })
        .perform();
  }

  async function isArchModExists(label: string): Promise<boolean> {
    let inject = (label: string): boolean => {
      return (window as any).getContext().allElements.some( (element: any) => {
        return element.TAG == "ArchMod" && element.label == label;
      } );
    };
    return await driver.executeScript(inject, label);
  }

  async function isArchModSelected(label: string): Promise<boolean> {
    let inject = (label: string): boolean => {
      return (window as any).getContext().selectedElements.some( (element: any) => {
        return element.TAG == "ArchMod" && element.label == label;
      } );
    };
    return await driver.executeScript(inject, label);
  }

  async function getArchModSize(label: string)
      : Promise<{ x: number, y: number, width: number, height: number, pinX: number, pinY: number}> {
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
  console.log("## cleanDownloadPath() : E");

  let fullPaths = getDownloadedFileFullPaths();

  fullPaths.forEach( (fullPath: string) => {
    fs.unlinkSync(fullPath);
    console.log(`## DEL: ${fullPath}`);
  } );

  console.log("## cleanDownloadPath() : X");
}

function loadLatestDownloadedJson(): object {
  let fullPaths = getDownloadedFileFullPaths();
  fullPaths.sort();
  let latest = fullPaths[fullPaths.length - 1];
  let jsonString = fs.readFileSync(latest).toString();
  let json = JSON.parse(jsonString);
  return json;
}

