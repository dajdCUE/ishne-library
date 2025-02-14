# ISHNE Parser

## Description
This library allows reading and analyzing ISHNE format files, a standard for storing Holter ECG data. It implements reading the header, ECG signals, and exporting data to JSON.

> ⚠️ **Warning**: This package is still under development and is not recommended for production use.

## Usage

### Load and parse an ISHNE file
```ts
import { IshneParser } from "ishne-parser";
import { readFileSync } from "fs";

const buffer = readFileSync("./file.ish");
const parser = new IshneParser(new Uint8Array(buffer));
const header = parser.parseHeader();
const ecgData = parser.parseEcgData();
console.log(parser.toJson());
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
