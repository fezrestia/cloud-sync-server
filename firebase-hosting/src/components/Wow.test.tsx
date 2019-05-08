import * as Enzyme from "enzyme";
import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";

import Wow from "./Wow";

Enzyme.configure( { adapter: new Adapter() } );

it("Do not crash while shadow rendering", () => {
    Enzyme.shallow(<Wow />);
});
