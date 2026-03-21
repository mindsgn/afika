import ExpoModulesCore
import Foundation
import PocketCore
import Security

public final class PocketModule: Module {
  // ---------------------------------------------------------------------------
  // Internal error type
  // ---------------------------------------------------------------------------
  private enum PocketModuleError: LocalizedError {
    case coreUnavailable
    case keychainFailure(String)

    var errorDescription: String? {
      switch self {
      case .coreUnavailable:
        return "PocketCore wallet instance is unavailable"
      case .keychainFailure(let message):
        return "Keychain error: \(message)"
      }
    }
  }

  private var walletCore: CoreWalletCore?
  private let keychainService  = "mindsgn.studio.pocket.core"
  private let masterKeyAccount = "wallet.master_key"
  private let kdfSaltAccount   = "wallet.kdf_salt"

  // ---------------------------------------------------------------------------
  // Module definition
  // ---------------------------------------------------------------------------
  public func definition() -> ModuleDefinition {
    Name("PocketCore")

    // ---- Lifecycle ----------------------------------------------------------

    /// initWallet(dataDir, masterKeyB64, kdfSaltB64)
    AsyncFunction("initWallet") { (dataDir: String, masterKeyB64: String, kdfSaltB64: String) throws in
      try self.initWallet(dataDir: dataDir, masterKeyB64: masterKeyB64, kdfSaltB64: kdfSaltB64)
    }

    /// initWalletSecure(dataDir) – auto-generates and persists key material in the iOS Keychain.
    AsyncFunction("initWalletSecure") { (dataDir: String) throws in
      let masterKeyB64 = try self.getOrCreateBase64Value(account: self.masterKeyAccount, bytes: 32)
      let kdfSaltB64   = try self.getOrCreateBase64Value(account: self.kdfSaltAccount,   bytes: 32)
      try self.initWallet(dataDir: dataDir, masterKeyB64: masterKeyB64, kdfSaltB64: kdfSaltB64)
    }

    AsyncFunction("closeWallet") { () throws in
      try self.callVoid { core in
        try core.close()
      }
    }

    // ---- Network / token registration (no error return) --------------------

    AsyncFunction("registerNetwork") { (name: String, rpcURL: String, chainID: Int64) throws in
      guard let core = self.walletCore else { throw PocketModuleError.coreUnavailable }
      core.registerNetwork(name, rpcURL: rpcURL, chainID: chainID)
    }

    AsyncFunction("registerToken") { (network: String, identifier: String, symbol: String, address: String, decimals: Int) throws in
      guard let core = self.walletCore else { throw PocketModuleError.coreUnavailable }
      core.registerToken(network, identifier: identifier, symbol: symbol, address: address, decimals: decimals)
    }

    // ---- Wallet management -------------------------------------------------

    AsyncFunction("createEthereumWallet") { (name: String) throws -> String in
      try self.callString { core, err in
        core.createEthereumWallet(name, error: &err)
      }
    }

    AsyncFunction("openOrCreateWallet") { (name: String) throws -> String in
      try self.callString { core, err in
        core.openOrCreateWallet(name, error: &err)
      }
    }

    AsyncFunction("getAddress") { () throws -> String in
      try self.callString { core, err in
        core.getAddress(&err)
      }
    }

    AsyncFunction("listAccounts") { () throws -> String in
      try self.callString { core, err in
        core.listAccounts(&err)
      }
    }

    // ---- Address utilities --------------------------------------------------

    /// validateAddress returns "true" | "false" – does not throw.
    AsyncFunction("validateAddress") { (addr: String) throws -> String in
      guard let core = self.walletCore else { throw PocketModuleError.coreUnavailable }
      return core.validateAddress(addr)
    }

    // ---- Signing ------------------------------------------------------------

    AsyncFunction("signMessage") { (message: String) throws -> String in
      try self.callString { core, err in
        core.signMessage(message, error: &err)
      }
    }

    AsyncFunction("exportPrivateKey") { () throws -> String in
      try self.callString { core, err in
        core.exportPrivateKey(&err)
      }
    }

    // ---- Balances -----------------------------------------------------------

    AsyncFunction("getTokenBalance") { (networkName: String, tokenIdentifier: String) throws -> String in
      try self.callString { core, err in
        core.getTokenBalance(networkName, tokenIdentifier: tokenIdentifier, error: &err)
      }
    }

    AsyncFunction("getAllBalances") { (networkName: String) throws -> String in
      try self.callString { core, err in
        core.getAllBalances(networkName, error: &err)
      }
    }

    AsyncFunction("syncBalances") { (networkName: String) throws -> String in
      try self.callString { core, err in
        core.syncBalances(networkName, error: &err)
      }
    }

    AsyncFunction("getLatestBalances") { (networkName: String) throws -> String in
      try self.callString { core, err in
        core.getLatestBalances(networkName, error: &err)
      }
    }

    AsyncFunction("upsertBalanceSnapshots") { (jsonPayload: String) throws in
      try self.callVoid { core in
        try core.upsertBalanceSnapshots(jsonPayload)
      }
    }

    AsyncFunction("getPriceHistory") { (networkName: String, limit: Int) throws -> String in
      try self.callString { core, err in
        core.getPriceHistory(networkName, limit: limit, error: &err)
      }
    }

    // ---- FX rates -----------------------------------------------------------

    AsyncFunction("upsertFXRate") { (pair: String, rate: String, fetchedAt: Int64) throws in
      try self.callVoid { core in
        try core.upsertFXRate(pair, rate: rate, fetchedAt: fetchedAt)
      }
    }

    AsyncFunction("latestFXRate") { (pair: String) throws -> String in
      try self.callString { core, err in
        core.latestFXRate(pair, error: &err)
      }
    }

    // ---- Watched addresses --------------------------------------------------

    AsyncFunction("addWatchedAddress") { (address: String, label: String) throws in
      try self.callVoid { core in
        try core.addWatchedAddress(address, label: label)
      }
    }

    AsyncFunction("listWatchedAddresses") { () throws -> String in
      try self.callString { core, err in
        core.listWatchedAddresses(&err)
      }
    }

    // ---- Recipients --------------------------------------------------------

    AsyncFunction("saveRecipient") { (jsonPayload: String) throws -> String in
      try self.callString { core, err in
        core.saveRecipient(jsonPayload, error: &err)
      }
    }

    AsyncFunction("getRecipient") { (id: String) throws -> String in
      try self.callString { core, err in
        core.getRecipient(id, error: &err)
      }
    }

    AsyncFunction("getAllRecipients") { () throws -> String in
      try self.callString { core, err in
        core.getAllRecipients(&err)
      }
    }

    AsyncFunction("searchRecipientsByName") { (name: String) throws -> String in
      try self.callString { core, err in
        core.searchRecipients(byName: name, error: &err)
      }
    }

    AsyncFunction("searchRecipientsByPhone") { (phone: String) throws -> String in
      try self.callString { core, err in
        core.searchRecipients(byPhone: phone, error: &err)
      }
    }

    AsyncFunction("updateRecipient") { (jsonPayload: String) throws -> String in
      try self.callString { core, err in
        core.updateRecipient(jsonPayload, error: &err)
      }
    }

    // ---- Sending ------------------------------------------------------------

    AsyncFunction("sendToken") { (networkName: String, tokenIdentifier: String, recipient: String, amount: String) throws -> String in
      try self.callString { core, err in
        core.sendToken(networkName, tokenIdentifier: tokenIdentifier, recipient: recipient, amount: amount, error: &err)
      }
    }

    AsyncFunction("sendUSDC") { (networkName: String, recipient: String, amount: String) throws -> String in
      try self.callString { core, err in
        core.sendUSDC(networkName, recipient: recipient, amount: amount, error: &err)
      }
    }

    // ---- Transactions -------------------------------------------------------

    AsyncFunction("syncInboundTransactions") { (networkName: String) throws -> String in
      try self.callString { core, err in
        core.syncInboundTransactions(networkName, error: &err)
      }
    }

    AsyncFunction("getTokenTransactions") { (networkName: String, tokenIdentifier: String, limit: Int, offset: Int) throws -> String in
      try self.callString { core, err in
        core.listTokenTransactions(networkName, tokenIdentifier: tokenIdentifier, limit: limit, offset: offset, error: &err)
      }
    }

    AsyncFunction("listAllTransactions") { (networkName: String, limit: Int, offset: Int) throws -> String in
      try self.callString { core, err in
        core.listAllTransactions(networkName, limit: limit, offset: offset, error: &err)
      }
    }

    AsyncFunction("upsertTransactions") { (jsonPayload: String) throws in
      try self.callVoid { core in
        try core.upsertTransactions(jsonPayload)
      }
    }

    // ---- Backup / restore ---------------------------------------------------

    AsyncFunction("exportBackup") { (passphrase: String) throws -> String in
      try self.callString { core, err in
        core.exportWalletBackup(passphrase, error: &err)
      }
    }

    AsyncFunction("importBackup") { (payload: String, passphrase: String) throws -> String in
      try self.callString { core, err in
        core.importWalletBackup(payload, passphrase: passphrase, error: &err)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private func initWallet(dataDir: String, masterKeyB64: String, kdfSaltB64: String) throws {
    walletCore = CoreNewWalletCore()
    try callVoid { core in
      try core.init_(dataDir, masterKeyB64: masterKeyB64, kdfSaltB64: kdfSaltB64)
    }
  }

  private func callVoid(_ action: (CoreWalletCore) throws -> Void) throws {
    guard let core = walletCore else { throw PocketModuleError.coreUnavailable }
    try action(core)
  }

  private func withCore<T>(_ action: (CoreWalletCore, inout NSError?) throws -> T) throws -> T {
    guard let core = walletCore else { throw PocketModuleError.coreUnavailable }
    var nsError: NSError?
    let result = try action(core, &nsError)
    if let nsError { throw nsError }
    return result
  }

  private func callString(_ action: (CoreWalletCore, inout NSError?) throws -> String) throws -> String {
    try withCore(action)
  }

  // ---------------------------------------------------------------------------
  // Keychain helpers
  // ---------------------------------------------------------------------------

  private func getOrCreateBase64Value(account: String, bytes: Int) throws -> String {
    if let existing = try readKeychain(account: account) {
      return existing.base64EncodedString()
    }
    let generated = try randomData(count: bytes)
    try writeKeychain(account: account, data: generated)
    return generated.base64EncodedString()
  }

  private func randomData(count: Int) throws -> Data {
    var data = Data(count: count)
    let status = data.withUnsafeMutableBytes { pointer in
      SecRandomCopyBytes(kSecRandomDefault, count, pointer.baseAddress!)
    }
    guard status == errSecSuccess else {
      throw PocketModuleError.keychainFailure("unable to generate secure random bytes")
    }
    return data
  }

  private func readKeychain(account: String) throws -> Data? {
    let query: [String: Any] = [
      kSecClass as String:       kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: account,
      kSecReturnData as String:  true,
      kSecMatchLimit as String:  kSecMatchLimitOne
    ]
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    switch status {
    case errSecSuccess:    return result as? Data
    case errSecItemNotFound: return nil
    default: throw PocketModuleError.keychainFailure("read failed with code \(status)")
    }
  }

  private func writeKeychain(account: String, data: Data) throws {
    let query: [String: Any] = [
      kSecClass as String:       kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: account
    ]
    let attributes: [String: Any] = [
      kSecValueData as String:       data,
      kSecAttrAccessible as String:  kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    ]
    let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if updateStatus == errSecSuccess { return }
    if updateStatus != errSecItemNotFound {
      throw PocketModuleError.keychainFailure("update failed with code \(updateStatus)")
    }
    var create = query
    create.merge(attributes) { _, new in new }
    let addStatus = SecItemAdd(create as CFDictionary, nil)
    guard addStatus == errSecSuccess else {
      throw PocketModuleError.keychainFailure("create failed with code \(addStatus)")
    }
  }
}
