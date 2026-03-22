const renderHomePage = (req, res) => {
  res.render("index", {
    title: "Kooliprojekt: Place",
    boardSize: 100,
  });
};

module.exports = {
  renderHomePage,
};