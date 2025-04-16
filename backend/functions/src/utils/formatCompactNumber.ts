const formatCompactNumber = (number: number) =>  {
    if (number < 1000) {
      return number.toFixed(2);
    } else if (number >= 1000 && number < 1_000_000) {
      return (number / 1000).toFixed(2) + "K";
    } else if (number >= 1_000_000 && number < 1_000_000_000) {
      return (number / 1_000_000).toFixed(2) + "M";
    } else if (number >= 1_000_000_000 && number < 1_000_000_000_000) {
      return (number / 1_000_000_000).toFixed(2) + "B";
    } else if (number >= 1_000_000_000_000 && number < 1_000_000_000_000_000) {
      return (number / 1_000_000_000_000).toFixed(2) + "T";
    }

    return 0
}

export { formatCompactNumber }