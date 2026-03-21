import { SendState } from "@/@src/types/send";

export const nextState = (state: SendState): SendState => {
  switch (state) {
    case "method":
      return "amount";
    case "amount":
      return "recipient";
    case "recipient":
      return "review";
    case "review":
      return "auth";
    case "auth":
      return "sending";
    case "sending":
      return "sent";
    default:
      return state;
  }
};

export const prevState = (state: SendState): SendState => {
  switch (state) {
    case "amount":
      return "method";
    case "recipient":
      return "amount";
    case "review":
      return "recipient";
    default:
      return state;
  }
};