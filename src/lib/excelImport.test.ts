import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseExcelWorkbook } from "./excelImport";

describe("Excel import compatibility", () => {
  it("imports namespace-prefixed xlsx workbooks", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="utf-8"?>
      <x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <x:sheets>
          <x:sheet name="采油工初级理论知识" sheetId="1" r:id="rSheet1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" />
        </x:sheets>
      </x:workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="utf-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" Id="rSheet1" />
      </Relationships>`);
    zip.file("xl/sharedStrings.xml", `<?xml version="1.0" encoding="utf-8"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" />`);
    zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="utf-8"?>
      <x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <x:sheetData>
          <x:row r="1">
            <x:c r="A1" t="str"><x:v>序号</x:v></x:c>
            <x:c r="B1" t="str"><x:v>题型</x:v></x:c>
            <x:c r="C1" t="str"><x:v>题目</x:v></x:c>
            <x:c r="D1" t="str"><x:v>选项</x:v></x:c>
            <x:c r="E1" t="str"><x:v>正确答案</x:v></x:c>
          </x:row>
          <x:row r="2">
            <x:c r="A2" t="n"><x:v>1</x:v></x:c>
            <x:c r="B2" t="str"><x:v>单选题</x:v></x:c>
            <x:c r="C2" t="str"><x:v>重质油多见于（）。</x:v></x:c>
            <x:c r="D2" t="str"><x:v>A. 黑色&#10;B. 褐色&#10;C. 黄色&#10;D. 橙色</x:v></x:c>
            <x:c r="E2" t="str"><x:v>A</x:v></x:c>
          </x:row>
        </x:sheetData>
      </x:worksheet>`);

    const bytes = await zip.generateAsync({ type: "uint8array" });
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const result = await parseExcelWorkbook(buffer, "采油工初级");

    expect(result.report.imported).toBe(1);
    expect(result.questions[0]).toMatchObject({
      type: "单选题",
      stemText: "重质油多见于（）。",
      answerKeys: ["A"]
    });
    expect(result.questions[0].options).toHaveLength(4);
  });

  it("collapses soft line breaks inside imported stems and option text", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="utf-8"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheets>
          <sheet name="题库" sheetId="1" r:id="rSheet1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" />
        </sheets>
      </workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="utf-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" Id="rSheet1" />
      </Relationships>`);
    zip.file("xl/sharedStrings.xml", `<?xml version="1.0" encoding="utf-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" />`);
    zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="utf-8"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1">
            <c r="A1" t="str"><v>序号</v></c>
            <c r="B1" t="str"><v>题型</v></c>
            <c r="C1" t="str"><v>题目</v></c>
            <c r="D1" t="str"><v>选项</v></c>
            <c r="E1" t="str"><v>正确答案</v></c>
          </row>
          <row r="2">
            <c r="A2" t="n"><v>1</v></c>
            <c r="B2" t="str"><v>判断题</v></c>
            <c r="C2" t="str"><v>二次运移不包括单一储层内的运移，只包括&#10;从这一储层向另一储层的运移。</v></c>
            <c r="D2" t="str"><v>A. 处理方式在同一句内&#10;不应另起一行&#10;B. 错</v></c>
            <c r="E2" t="str"><v>A</v></c>
          </row>
        </sheetData>
      </worksheet>`);

    const bytes = await zip.generateAsync({ type: "uint8array" });
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const result = await parseExcelWorkbook(buffer, "软换行测试");

    expect(result.questions[0].stemText).toBe("二次运移不包括单一储层内的运移，只包括从这一储层向另一储层的运移。");
    expect(result.questions[0].options.map((option) => option.text)).toEqual([
      "处理方式在同一句内不应另起一行",
      "错"
    ]);
  });

  it("keeps image-based options by adding editable placeholders", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="utf-8"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheets>
          <sheet name="题库" sheetId="1" r:id="rSheet1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" />
        </sheets>
      </workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="utf-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" Id="rSheet1" />
      </Relationships>`);
    zip.file("xl/sharedStrings.xml", `<?xml version="1.0" encoding="utf-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" />`);
    zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="utf-8"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1">
            <c r="A1" t="str"><v>序号</v></c>
            <c r="B1" t="str"><v>题型</v></c>
            <c r="C1" t="str"><v>题目</v></c>
            <c r="D1" t="str"><v>选项</v></c>
            <c r="E1" t="str"><v>正确答案</v></c>
            <c r="F1" t="str"><v>图片</v></c>
          </row>
          <row r="275">
            <c r="A275" t="n"><v>274</v></c>
            <c r="B275" t="str"><v>单选题</v></c>
            <c r="C275" t="str"><v>电感线圈通用的符号是（）。</v></c>
            <c r="D275" t="str"><v>A. &#10;B. —五&#10;C. &#10;D.</v></c>
            <c r="E275" t="str"><v>D</v></c>
            <c r="F275" t="str"><v>见嵌入图</v></c>
          </row>
        </sheetData>
      </worksheet>`);

    const bytes = await zip.generateAsync({ type: "uint8array" });
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const result = await parseExcelWorkbook(buffer, "图片选项测试", new Map([[0, ["examdeck-image:q274"]]]));

    expect(result.report.imported).toBe(1);
    expect(result.report.skipped).toBe(0);
    expect(result.questions[0].answerKeys).toEqual(["D"]);
    expect(result.questions[0].imageUrls).toEqual(["examdeck-image:q274"]);
    expect(result.questions[0].options.map((option) => option.text)).toEqual([
      "图片选项，请补充文字",
      "图片选项，请补充文字",
      "图片选项，请补充文字",
      "图片选项，请补充文字"
    ]);
  });
});
