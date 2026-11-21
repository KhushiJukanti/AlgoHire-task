const Centre = require('../models/centre.model');
const asyncHandler = require('../middlewares/asyncHandler');

exports.listCentres = asyncHandler(async (req, res) => {
  const filter = {};

  // Centre users see their own centre; district officers see their district.
  if (req.user.role === 'centre') {
    filter._id = req.user.centreId;
  } else if (req.user.role === 'district') {
    filter.districtId = req.user.districtId;
  }

  const centres = await Centre.find(filter).limit(500);
  res.json({ centres });
});
