package expo.modules.pocketcore

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import core.WalletCore
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.SecureRandom

class PocketModule : Module() {
  private var walletCore: WalletCore? = null

  override fun definition() = ModuleDefinition {
    Name("PocketCore")

    // ---- Lifecycle ----------------------------------------------------------

    AsyncFunction("initWallet") { dataDir: String, masterKeyB64: String, kdfSaltB64: String ->
      walletCore = WalletCore()
      callCore { walletCore!!.init(dataDir, masterKeyB64, kdfSaltB64) }
    }

    AsyncFunction("initWalletSecure") { dataDir: String ->
      val context = requireContext()
      val masterKeyB64 = getOrCreateBase64Value(context, "wallet.master_key", 32)
      val kdfSaltB64 = getOrCreateBase64Value(context, "wallet.kdf_salt", 32)
      walletCore = WalletCore()
      callCore { walletCore!!.init(dataDir, masterKeyB64, kdfSaltB64) }
    }

    AsyncFunction("closeWallet") {
      val core = walletCore ?: return@AsyncFunction null
      callCore { core.close() }
      walletCore = null
    }

    // ---- Network / token registration --------------------------------------

    AsyncFunction("registerNetwork") { name: String, rpcURL: String, chainID: Long ->
      val core = coreOrThrow()
      core.registerNetwork(name, rpcURL, chainID)
    }

    AsyncFunction("registerToken") { network: String, identifier: String, symbol: String, address: String, decimals: Long ->
      val core = coreOrThrow()
      core.registerToken(network, identifier, symbol, address, decimals)
    }

    // ---- Wallet management -------------------------------------------------

    AsyncFunction("createEthereumWallet") { name: String ->
      callCore { coreOrThrow().createEthereumWallet(name) }
    }

    AsyncFunction("openOrCreateWallet") { name: String ->
      callCore { coreOrThrow().openOrCreateWallet(name) }
    }

    AsyncFunction("getAddress") {
      callCore { coreOrThrow().getAddress() }
    }

    AsyncFunction("listAccounts") {
      callCore { coreOrThrow().listAccounts() }
    }

    // ---- Address utilities -------------------------------------------------

    AsyncFunction("validateAddress") { addr: String ->
      val core = coreOrThrow()
      core.validateAddress(addr)
    }

    // ---- Signing ------------------------------------------------------------

    AsyncFunction("signMessage") { message: String ->
      callCore { coreOrThrow().signMessage(message) }
    }

    AsyncFunction("exportPrivateKey") {
      callCore { coreOrThrow().exportPrivateKey() }
    }

    // ---- Balances -----------------------------------------------------------

    AsyncFunction("getTokenBalance") { networkName: String, tokenIdentifier: String ->
      callCore { coreOrThrow().getTokenBalance(networkName, tokenIdentifier) }
    }

    AsyncFunction("getAllBalances") { networkName: String ->
      callCore { coreOrThrow().getAllBalances(networkName) }
    }

    AsyncFunction("syncBalances") { networkName: String ->
      callCore { coreOrThrow().syncBalances(networkName) }
    }

    AsyncFunction("getLatestBalances") { networkName: String ->
      callCore { coreOrThrow().getLatestBalances(networkName) }
    }

    AsyncFunction("upsertBalanceSnapshots") { jsonPayload: String ->
      callCore { coreOrThrow().upsertBalanceSnapshots(jsonPayload) }
    }

    // ---- Price history ------------------------------------------------------

    AsyncFunction("getPriceHistory") { networkName: String, limit: Long ->
      callCore { coreOrThrow().getPriceHistory(networkName, limit) }
    }

    // ---- FX rates -----------------------------------------------------------

    AsyncFunction("upsertFXRate") { pair: String, rate: String, fetchedAt: Long ->
      callCore { coreOrThrow().upsertFXRate(pair, rate, fetchedAt) }
    }

    AsyncFunction("latestFXRate") { pair: String ->
      callCore { coreOrThrow().latestFXRate(pair) }
    }

    // ---- Watched addresses --------------------------------------------------

    AsyncFunction("addWatchedAddress") { address: String, label: String ->
      callCore { coreOrThrow().addWatchedAddress(address, label) }
    }

    AsyncFunction("listWatchedAddresses") {
      callCore { coreOrThrow().listWatchedAddresses() }
    }

    // ---- Recipients ---------------------------------------------------------

    AsyncFunction("saveRecipient") { jsonPayload: String ->
      callCore { coreOrThrow().saveRecipient(jsonPayload) }
    }

    AsyncFunction("getRecipient") { id: String ->
      callCore { coreOrThrow().getRecipient(id) }
    }

    AsyncFunction("getAllRecipients") {
      callCore { coreOrThrow().getAllRecipients() }
    }

    AsyncFunction("searchRecipientsByName") { name: String ->
      callCore { coreOrThrow().searchRecipientsByName(name) }
    }

    AsyncFunction("searchRecipientsByPhone") { phone: String ->
      callCore { coreOrThrow().searchRecipientsByPhone(phone) }
    }

    AsyncFunction("updateRecipient") { jsonPayload: String ->
      callCore { coreOrThrow().updateRecipient(jsonPayload) }
    }

    // ---- Token transfers ----------------------------------------------------

    AsyncFunction("sendToken") { networkName: String, tokenIdentifier: String, recipient: String, amount: String ->
      callCore { coreOrThrow().sendToken(networkName, tokenIdentifier, recipient, amount) }
    }

    AsyncFunction("sendUSDC") { networkName: String, recipient: String, amount: String ->
      callCore { coreOrThrow().sendUSDC(networkName, recipient, amount) }
    }

    // ---- Transactions -------------------------------------------------------

    AsyncFunction("syncInboundTransactions") { networkName: String ->
      callCore { coreOrThrow().syncInboundTransactions(networkName) }
    }

    AsyncFunction("listTokenTransactions") { networkName: String, tokenIdentifier: String, limit: Long, offset: Long ->
      callCore { coreOrThrow().listTokenTransactions(networkName, tokenIdentifier, limit, offset) }
    }

    AsyncFunction("listAllTransactions") { networkName: String, limit: Long, offset: Long ->
      callCore { coreOrThrow().listAllTransactions(networkName, limit, offset) }
    }

    AsyncFunction("upsertTransactions") { jsonPayload: String ->
      callCore { coreOrThrow().upsertTransactions(jsonPayload) }
    }

    // ---- Backup -------------------------------------------------------------

    AsyncFunction("exportWalletBackup") { passphrase: String ->
      callCore { coreOrThrow().exportWalletBackup(passphrase) }
    }

    AsyncFunction("importWalletBackup") { payload: String, passphrase: String ->
      callCore { coreOrThrow().importWalletBackup(payload, passphrase) }
    }
  }

  private fun coreOrThrow(): WalletCore {
    return walletCore ?: throw CodedException(code = "ERR_POCKET_CORE", message = "PocketCore wallet instance is unavailable", cause = null)
  }

  private fun requireContext(): Context {
    return appContext.reactContext?.applicationContext
      ?: throw CodedException(code = "ERR_POCKET_CORE", message = "React context unavailable", cause = null)
  }

  private fun <T> callCore(action: () -> T): T {
    try {
      return action()
    } catch (e: Exception) {
      throw CodedException(code = "ERR_POCKET_CORE", message = e.message ?: "PocketCore error", cause = e)
    }
  }

  private fun getOrCreateBase64Value(context: Context, key: String, bytes: Int): String {
    val masterKey = MasterKey.Builder(context)
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build()

    val prefs = EncryptedSharedPreferences.create(
      context,
      "pocket.core.keys",
      masterKey,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    val existing = prefs.getString(key, null)
    if (!existing.isNullOrBlank()) {
      return existing
    }

    val random = ByteArray(bytes)
    SecureRandom().nextBytes(random)
    val encoded = Base64.encodeToString(random, Base64.NO_WRAP)
    prefs.edit().putString(key, encoded).apply()
    return encoded
  }
}
