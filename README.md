# ISHNE Parser

## Description
This library allows reading and analyzing ISHNE format files, a standard for storing Holter ECG data. It implements reading the header, ECG signals, and exporting data to various formats.

> ⚠️ **Warning**: This package is still under development and is not recommended for production use.

## Usage

### Basic usage
```ts
import * as ishne from "jsr:@iradev/ishne";


const parser = new IshneParser(Deno.readFileSync("file.ecg"));
const header = parser.parseHeader();
const ecgData = parser.parseEcgData();
```

### Export Data
```ts
// Export to JSON
await parser.exportToJson("output.json", {
  timeColumn: true,
  decimalPlaces: 2
});

// Export to CSV
await parser.exportToCsv("output.csv", {
  separator: ",",
  includeHeader: true,
  timeColumn: true,
  decimalPlaces: 2
});

// Export to Text (tab-separated)
await parser.exportToText("output.txt");
```

### Export Options
```ts
interface ExportOptions {
  separator?: string;        // Separator for CSV/TXT (default: ',' for CSV, '\t' for TXT)
  includeHeader?: boolean;   // Include column headers (default: true)
  timeColumn?: boolean;      // Include time column (default: true)
  decimalPlaces?: number;    // Number of decimal places (default: 2)
}
```

## ISHNE File Structure

An ISHNE file contains:
- **Header (512 bytes)** with patient and recording information.
- **ECG Block** with signals stored in multiplexed binary format.
- **Optional Comments** for additional metadata.

The format is described in the official document:
> Badilini F. "The ISHNE Holter Standard Output File Format" (1998).

## Contribution
Pull requests and improvements are welcome. Make sure to follow the code structure and add tests if implementing new functions.

## License
This project is licensed under the MIT License.
