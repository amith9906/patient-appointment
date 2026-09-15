import React, { useState, useEffect, useRef } from 'react';

/**
 * PrescriptionMedicinePicker
 * Fast, typeahead-friendly medicine search, category filter chips, stock health indicators,
 * doctor quick-picks, route selection (Oral/IV/IM/Topical), and flagged non-formulary entry support.
 */
const PrescriptionMedicinePicker = ({ onAddPrescriptionItem, apiService }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentMeds, setRecentMeds] = useState([]);
  const [prescriptionList, setPrescriptionList] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Form state for selected/active medicine entry
  const [activeItem, setActiveItem] = useState(null);
  const [customName, setCustomName] = useState('');
  const [dose, setDose] = useState('1 tablet');
  const [frequency, setFrequency] = useState('1-0-1 (After Food)');
  const [duration, setDuration] = useState('5 days');
  const [route, setRoute] = useState('Oral');
  const [notes, setNotes] = useState('');

  const searchRef = useRef(null);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'tablet', label: 'Tablet / Capsule' },
    { id: 'injection', label: 'Injection' },
    { id: 'iv_fluid', label: 'IV Fluid' },
    { id: 'cream', label: 'Ointment / Cream' },
    { id: 'consumable', label: 'Consumable' },
    { id: 'other', label: 'Other' },
  ];

  const routeOptions = [
    'Oral',
    'IV (Intravenous)',
    'IM (Intramuscular)',
    'Subcutaneous (SC)',
    'IV Infusion',
    'Topical',
    'Ophthalmic (Eye)',
    'Otic (Ear)',
    'Inhalation',
    'Rectal / Suppository',
  ];

  // Load Recent Doctor Quick-Picks on Mount
  useEffect(() => {
    fetchRecentMeds();
  }, []);

  const fetchRecentMeds = async () => {
    try {
      if (apiService?.getRecentPrescribed) {
        const data = await apiService.getRecentPrescribed();
        setRecentMeds(data || []);
      }
    } catch (err) {
      console.error('Failed to load recent medications:', err);
    }
  };

  // Debounced Search Trigger (~300ms)
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query, selectedCategory);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedCategory]);

  const performSearch = async (text, cat) => {
    setIsLoading(true);
    try {
      if (apiService?.searchMedications) {
        const results = await apiService.searchMedications(text, cat);
        setSearchResults(results || []);
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Select a Formulary Medicine from Dropdown / Quick-Pick
  const handleSelectMedication = (med) => {
    setActiveItem(med);
    setCustomName('');
    setIsOpen(false);

    // Smart default route based on itemType
    let defaultRoute = 'Oral';
    let defaultDose = '1 tablet';
    if (med.itemType === 'injection') {
      defaultRoute = 'IV (Intravenous)';
      defaultDose = '1 vial';
    } else if (med.itemType === 'iv_fluid') {
      defaultRoute = 'IV Infusion';
      defaultDose = '500 ml';
    } else if (med.itemType === 'cream') {
      defaultRoute = 'Topical';
      defaultDose = 'Apply thin layer';
    } else if (med.itemType === 'drops') {
      defaultRoute = 'Ophthalmic (Eye)';
      defaultDose = '2 drops';
    } else if (med.itemType === 'inhaler') {
      defaultRoute = 'Inhalation';
      defaultDose = '2 puffs';
    }
    setRoute(defaultRoute);
    setDose(defaultDose);
  };

  // Flagged Non-Formulary Free-Text Selection (Policy Choice: Allowed with Flag)
  const handleSelectNonFormulary = () => {
    const nonFormularyItem = {
      id: null,
      name: query.trim(),
      composition: 'Custom Prescription Entry (Non-Formulary)',
      itemType: selectedCategory !== 'all' ? selectedCategory : 'other',
      unit: 'pcs',
      stockQuantity: 0,
      reorderLevel: 0,
      isUnmatchedFormulary: true,
    };
    setActiveItem(nonFormularyItem);
    setCustomName(query.trim());
    setIsOpen(false);
  };

  // Add Item to Prescription List
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!activeItem && !customName.trim()) return;

    const newItem = {
      id: activeItem?.id || `custom-${Date.now()}`,
      medicationId: activeItem?.id || null,
      name: activeItem?.name || customName.trim(),
      composition: activeItem?.composition || '',
      itemType: activeItem?.itemType || 'other',
      unit: activeItem?.unit || 'pcs',
      dose,
      frequency,
      duration,
      route,
      instructions: notes,
      stockQuantity: activeItem?.stockQuantity ?? 0,
      isUnmatchedFormulary: activeItem?.isUnmatchedFormulary || false,
    };

    const updated = [...prescriptionList, newItem];
    setPrescriptionList(updated);
    if (onAddPrescriptionItem) onAddPrescriptionItem(updated);

    // Reset picker input state
    setActiveItem(null);
    setQuery('');
    setCustomName('');
    setNotes('');
  };

  const handleRemoveItem = (index) => {
    const updated = prescriptionList.filter((_, i) => i !== index);
    setPrescriptionList(updated);
    if (onAddPrescriptionItem) onAddPrescriptionItem(updated);
  };

  // Stock Status Health Badge helper
  const getStockBadge = (stock, reorder) => {
    const qty = Number(stock || 0);
    const lvl = Number(reorder || 10);
    if (qty <= 0) {
      return <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded">Out of Stock (0)</span>;
    }
    if (qty <= lvl) {
      return <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">Low Stock ({qty})</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded">In Stock ({qty})</span>;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span>💊 Prescription Medicine Picker</span>
      </h3>

      {/* Doctor Quick-Picks / Frequently Prescribed */}
      {recentMeds.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            ⭐ Quick Pick (Frequently Prescribed)
          </label>
          <div className="flex flex-wrap gap-2">
            {recentMeds.map((med) => (
              <button
                key={med.id}
                type="button"
                onClick={() => handleSelectMedication(med)}
                className="px-3 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-full border border-indigo-200 transition-colors"
              >
                + {med.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter Chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Typeahead Search Input */}
      <div className="relative mb-4" ref={searchRef}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search medicine by name or composition (e.g. Paracetamol, Amoxicillin)..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />

        {isLoading && (
          <div className="absolute right-3 top-3 text-xs text-gray-400">Searching...</div>
        )}

        {/* Dropdown Results */}
        {isOpen && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((med) => (
                <div
                  key={med.id}
                  onClick={() => handleSelectMedication(med)}
                  className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{med.name}</div>
                    <div className="text-xs text-gray-500">
                      {med.composition} • <span className="uppercase text-blue-600">{med.itemType}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStockBadge(med.stockQuantity, med.reorderLevel)}
                    <div className="text-xs text-gray-500 mt-0.5">₹{med.unitPrice}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">No matching formulary medicine found for "{query}".</p>
                <button
                  type="button"
                  onClick={handleSelectNonFormulary}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-300 rounded text-xs font-semibold hover:bg-amber-100"
                >
                  ⚠️ Add "{query}" as Flagged Non-Formulary Entry
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Item Prescription Details Form */}
      {activeItem && (
        <div className="p-4 bg-gray-50 rounded-md border border-gray-200 mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-sm font-bold text-gray-900">{activeItem.name}</span>
              {activeItem.isUnmatchedFormulary && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 font-semibold rounded">
                  ⚠️ Non-Formulary Entry
                </span>
              )}
              <p className="text-xs text-gray-500">{activeItem.composition}</p>
            </div>
            {activeItem.id && getStockBadge(activeItem.stockQuantity, activeItem.reorderLevel)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dose / Strength</label>
              <input
                type="text"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
              <input
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Route</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs"
              >
                {routeOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Doctor Special Instructions</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Take with warm water, avoid alcohol"
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs"
            />
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-2 bg-blue-600 text-white font-semibold rounded text-xs hover:bg-blue-700 transition-colors"
          >
            + Add to Prescription
          </button>
        </div>
      )}

      {/* Prescription Items Summary Table */}
      {prescriptionList.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-bold text-gray-800 mb-2">Selected Prescription Items ({prescriptionList.length})</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="p-2 border">Medicine Name</th>
                  <th className="p-2 border">Dose</th>
                  <th className="p-2 border">Route</th>
                  <th className="p-2 border">Frequency</th>
                  <th className="p-2 border">Duration</th>
                  <th className="p-2 border">Action</th>
                </tr>
              </thead>
              <tbody>
                {prescriptionList.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">
                      {item.name}
                      {item.isUnmatchedFormulary && (
                        <span className="ml-1 text-amber-600 font-bold" title="Flagged Non-Formulary Entry">⚠️</span>
                      )}
                    </td>
                    <td className="p-2">{item.dose}</td>
                    <td className="p-2 font-semibold text-indigo-600">{item.route}</td>
                    <td className="p-2">{item.frequency}</td>
                    <td className="p-2">{item.duration}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-600 hover:text-red-800 font-bold"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionMedicinePicker;
